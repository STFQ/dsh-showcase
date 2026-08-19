import type { Moment, RedactionSummary } from "./types.js";

interface Rule {
  readonly type: string;
  readonly pattern: RegExp;
  readonly replacement:
    string | ((substring: string, ...args: string[]) => string);
}

const RULES: readonly Rule[] = [
  {
    type: "secret-assignment",
    pattern:
      /\b(api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[^\s,"';]{8,}["']?/gi,
    replacement: (_match, key) => `${key}=[REDACTED]`,
  },
  {
    type: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    type: "api-key",
    pattern: /\b(?:sk|ds)-[A-Za-z0-9_-]{16,}\b/g,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    type: "aws-key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replacement: "[REDACTED_AWS_KEY]",
  },
  {
    type: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: "[REDACTED_JWT]",
  },
  {
    type: "bearer",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi,
    replacement: "Bearer [REDACTED]",
  },
  {
    type: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    type: "windows-home",
    pattern: /\b[A-Za-z]:\\Users\\[^\\\s]+/g,
    replacement: "<HOME>",
  },
  {
    type: "unix-home",
    pattern: /\/(?:Users|home)\/[^/\s]+/g,
    replacement: "<HOME>",
  },
  {
    type: "url-credentials",
    pattern: /\b(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi,
    replacement: "$1[REDACTED]@",
  },
];

export function redactText(input: string, counts: Map<string, number>): string {
  let output = input;
  for (const rule of RULES) {
    output = output.replace(rule.pattern, (...args: unknown[]) => {
      counts.set(rule.type, (counts.get(rule.type) ?? 0) + 1);
      if (typeof rule.replacement === "string") return rule.replacement;
      return rule.replacement(...(args as [string, ...string[]]));
    });
  }
  return output;
}

export function redactMoments(moments: readonly Moment[]): {
  moments: Moment[];
  summary: RedactionSummary;
} {
  const counts = new Map<string, number>();
  const redacted = moments.map((moment) => ({
    ...moment,
    title: redactText(moment.title, counts),
    body: redactText(moment.body, counts),
  }));
  const byType = Object.fromEntries(
    [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    moments: redacted,
    summary: {
      total: [...counts.values()].reduce((sum, value) => sum + value, 0),
      byType,
    },
  };
}

export function redactShowcase(
  moments: readonly Moment[],
  title: string,
): { moments: Moment[]; title: string; summary: RedactionSummary } {
  const counts = new Map<string, number>();
  const redacted = moments.map((moment) => ({
    ...moment,
    title: redactText(moment.title, counts),
    body: redactText(moment.body, counts),
  }));
  const redactedTitle = redactText(title, counts);
  const byType = Object.fromEntries(
    [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    moments: redacted,
    title: redactedTitle,
    summary: {
      total: [...counts.values()].reduce((sum, value) => sum + value, 0),
      byType,
    },
  };
}
