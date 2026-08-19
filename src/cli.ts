#!/usr/bin/env node
import { parseArgs } from "node:util";
import { asShowcaseError, EXIT, ShowcaseError } from "./errors.js";
import { PROJECT_URL, VERSION } from "./meta.js";
import type { OutputFormat, RedactMode, ThemeName } from "./types.js";

const HELP = `dsh-showcase — GitHub-ready demos from DeepSeek Harness sessions

USAGE
  dsh-showcase <session.jsonl|session.jsonl.zstd|dsh-session.zip|-> [options]

EXAMPLES
  dsh-showcase dsh-session.zip
  dsh-showcase session.jsonl --theme midnight --format both
  cat session.jsonl | dsh-showcase - --json --dry-run

ARGUMENT
  session                  Official DSH export ZIP, raw JSONL, Zstd JSONL, or - for stdin

OPTIONS
  -o, --output <dir>       Output directory (default: dsh-showcase-output)
      --format <value>     webp, gif, or both (default: webp)
      --theme <value>      deepsea, midnight, or paper (default: deepsea)
      --redact <value>     auto, strict, or off (default: auto)
      --title <text>       Override the cover title
      --max-scenes <n>     Total scenes including cover, 2–8 (default: 5)
      --dry-run            Parse, select, and scan without writing files
      --overwrite          Replace only known generated artifacts
      --json               Write one versioned JSON result to stdout
      --quiet              Suppress human-readable success output
  -h, --help               Show this help
  -v, --version            Show the version

OUTPUTS
  hero.webp / hero.gif, poster.png, social-preview.png,
  README-snippet.md, showcase.manifest.json

AUTOMATION
  With --json, stdout contains JSON only. Warnings and errors use stderr.
  The tool never uploads data, executes session tools, or calls an AI model.

EXIT STATUS
  0 success; 2 invalid input; 3 strict redaction stop; 4 render failure;
  5 output conflict; 130 interrupted

DOCS
  ${PROJECT_URL}#readme
  ${PROJECT_URL}/issues
`;

function enumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  label: string,
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new ShowcaseError(
    `${label} must be one of: ${allowed.join(", ")}.`,
    EXIT.input,
  );
}

function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 2 || parsed > 8) {
    throw new ShowcaseError(
      "--max-scenes must be an integer from 2 to 8.",
      EXIT.input,
    );
  }
  return parsed;
}

function requireSupportedNode(): void {
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 19)) {
    throw new ShowcaseError(
      `Node.js 22.19 or newer is required; found ${process.versions.node}.`,
      EXIT.input,
    );
  }
}

async function main(): Promise<void> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      strict: true,
      options: {
        output: {
          type: "string",
          short: "o",
          default: "dsh-showcase-output",
        },
        format: { type: "string", default: "webp" },
        theme: { type: "string", default: "deepsea" },
        redact: { type: "string", default: "auto" },
        title: { type: "string" },
        "max-scenes": { type: "string", default: "5" },
        "dry-run": { type: "boolean", default: false },
        overwrite: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        quiet: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
  } catch (error) {
    throw new ShowcaseError(
      error instanceof Error ? error.message : String(error),
      EXIT.input,
      { cause: error },
    );
  }
  if (parsed.values.help) {
    process.stdout.write(HELP);
    return;
  }
  if (parsed.values.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (parsed.positionals.length !== 1)
    throw new ShowcaseError(
      "Pass exactly one session path or - for stdin.",
      EXIT.input,
    );

  requireSupportedNode();
  const { createShowcase } = await import("./index.js");

  const result = await createShowcase({
    input: parsed.positionals[0] as string,
    output: parsed.values.output as string,
    format: enumValue(
      parsed.values.format as string,
      ["webp", "gif", "both"] as const,
      "--format",
    ) as OutputFormat,
    theme: enumValue(
      parsed.values.theme as string,
      ["deepsea", "midnight", "paper"] as const,
      "--theme",
    ) as ThemeName,
    redact: enumValue(
      parsed.values.redact as string,
      ["auto", "strict", "off"] as const,
      "--redact",
    ) as RedactMode,
    ...(typeof parsed.values.title === "string"
      ? { title: parsed.values.title }
      : {}),
    maxScenes: positiveInteger(parsed.values["max-scenes"] as string),
    dryRun: parsed.values["dry-run"] as boolean,
    overwrite: parsed.values.overwrite as boolean,
  });

  if (parsed.values.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (!parsed.values.quiet) {
    const verb = result.dryRun ? "Planned" : "Created";
    process.stdout.write(
      `${verb} ${result.scenes.length + 1} scenes from ${result.input.events} DSH events.\n`,
    );
    for (const artifact of result.artifacts)
      process.stdout.write(`  ${artifact.path}\n`);
    if (result.redactions.total > 0)
      process.stdout.write(
        `Redacted ${result.redactions.total} sensitive value(s).\n`,
      );
  }
  for (const warning of result.warnings)
    process.stderr.write(`warning: ${warning}\n`);
}

process.once("SIGINT", () => {
  process.exit(EXIT.interrupted);
});

main().catch((error: unknown) => {
  const failure = asShowcaseError(error);
  process.stderr.write(`dsh-showcase: ${failure.message}\n`);
  process.exitCode = failure.exitCode;
});
