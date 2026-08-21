import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { unzipSync } from "fflate";
import { EXIT, ShowcaseError } from "./errors.js";
import type { ParsedSession, SessionEvent, SessionHeader } from "./types.js";
import { decompressConcatenatedZstd, hasZstdMagic } from "./zstd.js";

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const ZIP_LOCAL_FILE_MAGIC = 0x04034b50;
const PACKED_TAGS = new Set([
  "text-chunks",
  "reasoning-chunks",
  "tool-call-chunks",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > MAX_INPUT_BYTES) {
      throw new ShowcaseError(
        "Standard input exceeds the 64 MiB safety limit.",
        EXIT.input,
      );
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, bytes);
}

async function readBoundedInput(input: string | Uint8Array): Promise<Buffer> {
  if (input instanceof Uint8Array) {
    const buffer = Buffer.from(input);
    if (buffer.length > MAX_INPUT_BYTES) {
      throw new ShowcaseError(
        "Input exceeds the 64 MiB safety limit.",
        EXIT.input,
      );
    }
    return buffer;
  }
  if (input === "-") return readStdin();
  let buffer: Buffer;
  try {
    buffer = await readFile(input);
  } catch (error) {
    throw new ShowcaseError(`Cannot read input: ${input}`, EXIT.input, {
      cause: error,
    });
  }
  if (buffer.length > MAX_INPUT_BYTES) {
    throw new ShowcaseError(
      "Input exceeds the 64 MiB safety limit.",
      EXIT.input,
    );
  }
  return buffer;
}

function isZip(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.readUInt32LE(0) === ZIP_LOCAL_FILE_MAGIC;
}

function readRootFromExportZip(buffer: Buffer): {
  data: Buffer;
  name: string;
  subagentCount: number;
} {
  let entries: Record<string, Uint8Array>;
  const subagentIds = new Set<string>();
  try {
    entries = unzipSync(new Uint8Array(buffer), {
      filter(file) {
        const child = /^subagents\/([^/]+)\/session\.jsonl(?:\.zstd)?$/.exec(
          file.name,
        );
        if (child?.[1]) subagentIds.add(child[1]);
        const root =
          file.name === "session.jsonl" || file.name === "session.jsonl.zstd";
        return root && file.originalSize <= MAX_INPUT_BYTES;
      },
    });
  } catch (error) {
    throw new ShowcaseError(
      "Could not read the DSH session export ZIP.",
      EXIT.input,
      { cause: error },
    );
  }
  const name = entries["session.jsonl"]
    ? "session.jsonl"
    : entries["session.jsonl.zstd"]
      ? "session.jsonl.zstd"
      : undefined;
  if (name === undefined) {
    throw new ShowcaseError(
      "The ZIP has no root session.jsonl or session.jsonl.zstd entry.",
      EXIT.input,
    );
  }
  const data = entries[name];
  if (data === undefined)
    throw new ShowcaseError("The root session entry is empty.", EXIT.input);

  return { data: Buffer.from(data), name, subagentCount: subagentIds.size };
}

function expandPackedRow(
  value: Record<string, unknown>,
  line: number,
): SessionEvent[] {
  const tag = value.type;
  if (typeof tag !== "string" || !PACKED_TAGS.has(tag))
    return [value as SessionEvent];
  const seq0 = value.seq0;
  const time0 = value.time0;
  const data = value.data;
  if (
    !Number.isSafeInteger(seq0) ||
    !Number.isSafeInteger(time0) ||
    !isRecord(data)
  ) {
    throw new ShowcaseError(
      `Malformed ${tag} storage row at line ${line}.`,
      EXIT.input,
    );
  }
  const turn = data.turn;
  const step = data.step;
  const index = data.index;
  const gaps = data.dt;
  const members = tag === "tool-call-chunks" ? data.args : data.texts;
  if (
    typeof turn !== "number" ||
    typeof step !== "number" ||
    typeof index !== "number" ||
    !Array.isArray(gaps) ||
    !Array.isArray(members) ||
    members.length === 0 ||
    members.some((item) => typeof item !== "string") ||
    gaps.some((gap) => !Number.isSafeInteger(gap)) ||
    gaps.length !== members.length - 1
  ) {
    throw new ShowcaseError(
      `Malformed ${tag} storage row at line ${line}.`,
      EXIT.input,
    );
  }

  let time = time0 as number;
  return (members as string[]).map((member, indexInRun) => {
    if (indexInRun > 0) time += gaps[indexInRun - 1] as number;
    const chunk =
      tag === "text-chunks"
        ? { type: "text-delta", index, text: member }
        : tag === "reasoning-chunks"
          ? { type: "reasoning-delta", index, text: member }
          : {
              type: "tool-call-delta",
              index,
              id: data.id,
              ...(typeof data.name === "string" ? { name: data.name } : {}),
              argumentsDelta: member,
            };
    return {
      type: "assistant/chunk",
      seq: (seq0 as number) + indexInRun,
      time,
      data: { turn, step, chunk },
    };
  });
}

function parseJsonl(
  text: string,
  inputLabel: string,
): { header?: SessionHeader; events: SessionEvent[]; warnings: string[] } {
  const lines = text.split(/\r?\n/);
  const hasCompleteTail = text.endsWith("\n") || text.endsWith("\r");
  const warnings: string[] = [];
  const events: SessionEvent[] = [];
  let header: SessionHeader | undefined;

  for (let index = 0; index < lines.length; index++) {
    const source = lines[index]?.trim();
    if (!source) continue;
    let value: unknown;
    try {
      value = JSON.parse(source);
    } catch (error) {
      if (index === lines.length - 1 && !hasCompleteTail) {
        warnings.push("Ignored an incomplete final JSONL record.");
        break;
      }
      throw new ShowcaseError(
        `Invalid JSON at ${inputLabel}:${index + 1}.`,
        EXIT.input,
        { cause: error },
      );
    }
    if (!isRecord(value) || typeof value.type !== "string") {
      throw new ShowcaseError(
        `Expected an object with a type at ${inputLabel}:${index + 1}.`,
        EXIT.input,
      );
    }
    if (value.type === "session" && header === undefined) {
      header = value as SessionHeader;
      continue;
    }
    events.push(...expandPackedRow(value, index + 1));
  }

  if (header === undefined)
    warnings.push(
      "No DSH session header was found; parsed in best-effort mode.",
    );
  else if (header.version !== undefined && header.version !== 0) {
    warnings.push(
      `Session format v${String(header.version)} is newer than the verified v0 adapter.`,
    );
  }
  if (header !== undefined) {
    for (let index = 0; index < events.length; index++) {
      const seq = events[index]?.seq;
      if (seq === undefined) {
        warnings.push(
          "At least one event has no sequence number; continuity was not verified.",
        );
        break;
      }
      if (seq !== index) {
        throw new ShowcaseError(
          `Session sequence gap: expected ${index}, received ${seq}.`,
          EXIT.input,
        );
      }
    }
  }
  if (events.length === 0)
    throw new ShowcaseError(
      "The session contains no renderable events.",
      EXIT.input,
    );
  return header === undefined
    ? { events, warnings }
    : { header, events, warnings };
}

export async function parseSession(
  input: string | Uint8Array,
  inputLabel?: string,
): Promise<ParsedSession> {
  const source = await readBoundedInput(input);
  const label =
    inputLabel ??
    (typeof input === "string"
      ? input === "-"
        ? "stdin"
        : basename(input)
      : "session export");
  let bytes = source;
  let sourceFormat: ParsedSession["sourceFormat"] = "jsonl";
  let subagentCount = 0;
  const outerWarnings: string[] = [];

  if (isZip(source)) {
    const root = readRootFromExportZip(source);
    bytes = root.data;
    subagentCount = root.subagentCount;
    sourceFormat = "dsh-export.zip";
    if (subagentCount > 0)
      outerWarnings.push(
        `${subagentCount} subagent log(s) detected; v0.1 renders the root session only.`,
      );
  }

  let text: string;
  if (hasZstdMagic(bytes)) {
    const decoded = await decompressConcatenatedZstd(bytes);
    text = decoded.text;
    if (sourceFormat !== "dsh-export.zip") sourceFormat = "jsonl.zstd";
    if (decoded.torn)
      outerWarnings.push("Ignored an incomplete final Zstandard frame.");
  } else {
    text = bytes.toString("utf8");
  }

  const parsed = parseJsonl(text, label);
  return {
    ...parsed,
    sourceFormat,
    inputLabel: label,
    warnings: [...outerWarnings, ...parsed.warnings],
    subagentCount,
  };
}
