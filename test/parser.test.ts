import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zstdCompressSync } from "node:zlib";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parseSession } from "../src/parser.js";

const JSONL = [
  '{"type":"session","version":0,"id":"test","createdAt":1,"delegationDepth":0}',
  '{"type":"user/message","seq":0,"time":1,"data":{"role":"user","content":[{"type":"text","text":"hello"}],"source":{"kind":"user"}}}',
  '{"type":"text-chunks","seq0":1,"time0":2,"data":{"turn":1,"step":1,"index":0,"dt":[1,1],"texts":["o","k","!"]}}',
  "",
].join("\n");

async function tempFile(
  name: string,
  data: Uint8Array | string,
): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "dsh-showcase-"));
  const path = join(root, name);
  await writeFile(path, data);
  return path;
}

describe("parseSession", () => {
  it("reads raw DSH JSONL and expands packed chunk rows", async () => {
    const path = await tempFile("session.jsonl", JSONL);
    const session = await parseSession(path);
    expect(session.header?.id).toBe("test");
    expect(session.sourceFormat).toBe("jsonl");
    expect(session.events).toHaveLength(4);
    expect(session.events.at(-1)?.type).toBe("assistant/chunk");
  });

  it("accepts bytes supplied by the DSH filesystem provider", async () => {
    const session = await parseSession(
      new TextEncoder().encode(JSONL),
      "exported-session.jsonl",
    );
    expect(session.inputLabel).toBe("exported-session.jsonl");
    expect(session.sourceFormat).toBe("jsonl");
    expect(session.events).toHaveLength(4);
  });

  it("reads concatenated Zstandard frames used by DSH persistence", async () => {
    const [header, ...events] = JSONL.trimEnd().split("\n");
    const encoded = Buffer.concat([
      zstdCompressSync(`${header}\n`),
      zstdCompressSync(`${events.join("\n")}\n`),
    ]);
    const path = await tempFile("session.jsonl.zstd", encoded);
    const session = await parseSession(path);
    expect(session.sourceFormat).toBe("jsonl.zstd");
    expect(session.events).toHaveLength(4);
  });

  it("reads the root session from the official DSH export ZIP shape", async () => {
    const archive = zipSync({
      "session.jsonl": strToU8(JSONL),
      "subagents/child/session.jsonl": strToU8(
        JSONL.replace('"id":"test"', '"id":"child"'),
      ),
      "media/example.png": new Uint8Array([1, 2, 3]),
    });
    const path = await tempFile("dsh-session-test.zip", archive);
    const session = await parseSession(path);
    expect(session.sourceFormat).toBe("dsh-export.zip");
    expect(session.header?.id).toBe("test");
    expect(session.subagentCount).toBe(1);
  });

  it("rejects malformed committed JSON instead of inventing a demo", async () => {
    const path = await tempFile("broken.jsonl", '{"type":"session"}\n{nope}\n');
    await expect(parseSession(path)).rejects.toMatchObject({ exitCode: 2 });
  });

  it("ignores only an incomplete final JSONL record", async () => {
    const path = await tempFile(
      "torn.jsonl",
      `${JSONL.trimEnd()}\n{"type":"assistant/message"`,
    );
    const session = await parseSession(path);
    expect(session.events).toHaveLength(4);
    expect(session.warnings).toContain(
      "Ignored an incomplete final JSONL record.",
    );
  });

  it("rejects a sequence gap in a headed DSH session", async () => {
    const path = await tempFile(
      "gap.jsonl",
      [
        '{"type":"session","version":0,"id":"gap","createdAt":1,"delegationDepth":0}',
        '{"type":"user/message","seq":4,"time":1,"data":{"content":[{"type":"text","text":"hello"}]}}',
        "",
      ].join("\n"),
    );
    await expect(parseSession(path)).rejects.toMatchObject({ exitCode: 2 });
  });
});
