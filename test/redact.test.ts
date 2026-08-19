import { describe, expect, it } from "vitest";
import { redactMoments, redactShowcase } from "../src/redact.js";

describe("redactMoments", () => {
  it("redacts common secrets, identity, and home paths with a report", () => {
    const result = redactMoments([
      {
        kind: "prompt",
        eyebrow: "PROMPT",
        title: "Contact dev@example.com",
        body: "api_key=sk-abcdefghijklmnop at C:\\Users\\alice\\project",
      },
    ]);
    expect(result.moments[0]?.title).not.toContain("dev@example.com");
    expect(result.moments[0]?.body).not.toContain("sk-abcdefghijklmnop");
    expect(result.moments[0]?.body).not.toContain("alice");
    expect(result.summary.total).toBe(3);
  });

  it("does not mutate the source moments", () => {
    const source = [
      {
        kind: "prompt" as const,
        eyebrow: "PROMPT",
        title: "Safe",
        body: "hello",
      },
    ];
    const result = redactMoments(source);
    expect(result.moments).not.toBe(source);
    expect(source[0]?.body).toBe("hello");
  });

  it("applies the same policy to the cover title", () => {
    const result = redactShowcase(
      [{ kind: "answer", eyebrow: "RESULT", title: "Done", body: "Safe" }],
      "Preview for owner@example.com",
    );
    expect(result.title).toBe("Preview for [REDACTED_EMAIL]");
    expect(result.summary.byType.email).toBe(1);
  });
});
