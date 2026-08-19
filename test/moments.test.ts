import { describe, expect, it } from "vitest";
import { selectMoments } from "../src/moments.js";

describe("selectMoments", () => {
  it("selects a chronological prompt, tool, diff, and final answer", () => {
    const moments = selectMoments(
      [
        {
          type: "user/message",
          seq: 1,
          data: {
            content: [{ type: "text", text: "Build it" }],
            source: { kind: "user" },
          },
        },
        {
          type: "tool/call",
          seq: 2,
          data: { name: "apply_patch", arguments: '{"file":"a.ts"}' },
        },
        {
          type: "tool/result",
          seq: 3,
          data: { meta: { diff: "@@ -1 +1 @@\n-old\n+new" } },
        },
        {
          type: "assistant/message",
          seq: 4,
          data: { message: { content: [{ type: "text", text: "Done" }] } },
        },
      ],
      5,
    );
    expect(moments.map((moment) => moment.kind)).toEqual([
      "prompt",
      "tool",
      "diff",
      "answer",
    ]);
  });

  it("never includes reasoning-only blocks", () => {
    const moments = selectMoments(
      [
        {
          type: "user/message",
          seq: 1,
          data: {
            content: [{ type: "text", text: "Question" }],
            source: { kind: "user" },
          },
        },
        {
          type: "assistant/message",
          seq: 2,
          data: {
            message: {
              content: [
                { type: "reasoning", text: "private chain" },
                { type: "text", text: "Public answer" },
              ],
            },
          },
        },
      ],
      5,
    );
    expect(moments.map((moment) => moment.body).join(" ")).not.toContain(
      "private chain",
    );
    expect(moments.at(-1)?.body).toContain("Public answer");
  });
});
