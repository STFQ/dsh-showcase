import type { Moment, SessionEvent } from "./types.js";

const MAX_BODY_CHARS = 620;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collapseWhitespace(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(value: string, max = MAX_BODY_CHARS): string {
  const clean = collapseWhitespace(value);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

function textFromContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map(textFromContent).filter(Boolean).join("\n");
  if (!isRecord(value)) return "";
  if (value.type === "reasoning" || value.type === "reasoning-delta") return "";
  if (value.type === "image") return "[image attachment]";
  if (typeof value.text === "string") return value.text;
  if (Array.isArray(value.content)) return textFromContent(value.content);
  if (typeof value.output === "string") return value.output;
  return "";
}

function messageFromEvent(
  event: SessionEvent,
): Record<string, unknown> | undefined {
  if (!isRecord(event.data)) return undefined;
  if (isRecord(event.data.message)) return event.data.message;
  return event.data;
}

function findDiff(value: unknown, depth = 0): string | undefined {
  if (depth > 5) return undefined;
  if (typeof value === "string") {
    const hasDiffMarkers =
      /(^|\n)(?:diff --git|@@ |\+\+\+ |--- |[+-]{3}\b)/m.test(value);
    return hasDiffMarkers ? value : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDiff(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  for (const key of [
    "diff",
    "patch",
    "unifiedDiff",
    "changes",
    "content",
    "text",
  ]) {
    if (Object.hasOwn(value, key)) {
      const found = findDiff(value[key], depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}

function toolArguments(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    return JSON.stringify(JSON.parse(value) as unknown, null, 2);
  } catch {
    return value;
  }
}

function assistantChunkFallback(events: readonly SessionEvent[]): string {
  let text = "";
  for (const event of events) {
    if (
      event.type !== "assistant/chunk" ||
      !isRecord(event.data) ||
      !isRecord(event.data.chunk)
    )
      continue;
    const chunk = event.data.chunk;
    if (chunk.type === "text-delta" && typeof chunk.text === "string")
      text += chunk.text;
  }
  return text;
}

export function selectMoments(
  events: readonly SessionEvent[],
  maxScenes: number,
): Moment[] {
  const prompts: Moment[] = [];
  const tools: Moment[] = [];
  const diffs: Moment[] = [];
  const results: Moment[] = [];
  const answers: Moment[] = [];

  for (const event of events) {
    if (event.type === "user/message") {
      const message = messageFromEvent(event);
      if (
        message?.source &&
        isRecord(message.source) &&
        message.source.kind !== "user"
      )
        continue;
      const body = truncate(textFromContent(message?.content));
      if (body)
        prompts.push({
          kind: "prompt",
          eyebrow: "PROMPT",
          title: "What the user asked",
          body,
          ...(event.seq === undefined ? {} : { seq: event.seq }),
        });
      continue;
    }

    if (event.type === "tool/call" && isRecord(event.data)) {
      const name =
        typeof event.data.name === "string" ? event.data.name : "tool";
      const body = truncate(
        toolArguments(event.data.arguments) || "Tool invoked",
      );
      tools.push({
        kind: "tool",
        eyebrow: "TOOL CALL",
        title: name,
        body,
        ...(event.seq === undefined ? {} : { seq: event.seq }),
      });
      continue;
    }

    if (event.type === "tool/result" && isRecord(event.data)) {
      const diff = findDiff(event.data.meta) ?? findDiff(event.data.message);
      if (diff) {
        diffs.push({
          kind: "diff",
          eyebrow: "CODE CHANGE",
          title: "A focused patch",
          body: truncate(diff),
          ...(event.seq === undefined ? {} : { seq: event.seq }),
        });
      } else {
        const message = isRecord(event.data.message)
          ? event.data.message
          : event.data;
        const body = truncate(textFromContent(message.content));
        if (body)
          results.push({
            kind: "result",
            eyebrow: "TOOL RESULT",
            title: event.data.error
              ? "Tool reported an error"
              : "Tool completed",
            body,
            ...(event.seq === undefined ? {} : { seq: event.seq }),
          });
      }
      continue;
    }

    if (event.type === "assistant/message") {
      const message = messageFromEvent(event);
      const body = truncate(textFromContent(message?.content));
      if (body)
        answers.push({
          kind: "answer",
          eyebrow: "RESULT",
          title: "What shipped",
          body,
          ...(event.seq === undefined ? {} : { seq: event.seq }),
        });
    }
  }

  if (answers.length === 0) {
    const fallback = truncate(assistantChunkFallback(events));
    if (fallback)
      answers.push({
        kind: "answer",
        eyebrow: "RESULT",
        title: "What shipped",
        body: fallback,
      });
  }

  const capacity = Math.max(2, Math.min(8, maxScenes)) - 1; // Reserve one frame for the cover.
  const selected: Moment[] = [];
  const add = (moment: Moment | undefined): void => {
    if (moment && selected.length < capacity && !selected.includes(moment))
      selected.push(moment);
  };
  add(prompts[0]);
  add(answers.at(-1));
  add(diffs[0]);
  add(tools[0]);
  add(results.at(-1));

  const ordered = selected.sort(
    (a, b) =>
      (a.seq ?? Number.MAX_SAFE_INTEGER) - (b.seq ?? Number.MAX_SAFE_INTEGER),
  );
  if (ordered.length === 0) {
    throw new Error(
      "No user, tool, diff, result, or assistant text could be extracted from this session.",
    );
  }
  return ordered.slice(0, capacity);
}

export function suggestedTitle(moments: readonly Moment[]): string {
  const prompt = moments.find((moment) => moment.kind === "prompt")?.body;
  if (!prompt) return "DeepSeek Harness session";
  const firstLine = prompt.split("\n")[0]?.trim() ?? prompt;
  return truncate(firstLine, 72);
}
