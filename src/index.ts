import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { EXIT, ShowcaseError } from "./errors.js";
import { PROJECT_URL, VERSION } from "./meta.js";
import { selectMoments, suggestedTitle } from "./moments.js";
import { parseSession } from "./parser.js";
import { redactShowcase } from "./redact.js";
import { renderAssets } from "./render.js";
import type {
  ArtifactResult,
  Moment,
  ShowcaseOptions,
  ShowcaseResult,
} from "./types.js";

export type * from "./types.js";
export { parseSession } from "./parser.js";
export { redactMoments, redactShowcase, redactText } from "./redact.js";
export { selectMoments } from "./moments.js";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function readmeSnippet(format: ShowcaseOptions["format"]): string {
  const hero = format === "gif" ? "hero.gif" : "hero.webp";
  return `[![DeepSeek Harness session demo](${hero})](${PROJECT_URL})\n\n<sub>Generated locally with [dsh-showcase](${PROJECT_URL}) — no upload, no model calls.</sub>\n`;
}

function manifest(
  input: ShowcaseResult["input"],
  moments: readonly Moment[],
  redactions: ShowcaseResult["redactions"],
  warnings: readonly string[],
): string {
  return `${JSON.stringify(
    {
      schemaVersion: 1,
      generator: "dsh-showcase",
      generatorVersion: VERSION,
      input,
      scenes: moments,
      redactions,
      warnings,
    },
    null,
    2,
  )}\n`;
}

async function assertWritable(
  paths: readonly string[],
  overwrite: boolean,
): Promise<void> {
  if (overwrite) return;
  const conflicts = [];
  for (const path of paths) if (await exists(path)) conflicts.push(path);
  if (conflicts.length > 0) {
    throw new ShowcaseError(
      `Output already exists: ${conflicts.join(", ")}. Pass --overwrite to replace generated artifacts.`,
      EXIT.conflict,
    );
  }
}

export async function createShowcase(
  options: ShowcaseOptions,
): Promise<ShowcaseResult> {
  const started = performance.now();
  const parsed = await parseSession(options.input, options.inputLabel);
  const selected = selectMoments(parsed.events, options.maxScenes);
  const rawTitle = options.title ?? suggestedTitle(selected);
  const redacted =
    options.redact === "off"
      ? {
          moments: selected,
          title: rawTitle,
          summary: { total: 0, byType: {} },
        }
      : redactShowcase(selected, rawTitle);
  const warnings = [...parsed.warnings];
  if (options.redact === "off")
    warnings.push(
      "Redaction is disabled. Review every generated artifact before publishing.",
    );
  if (options.redact === "strict" && redacted.summary.total > 0) {
    throw new ShowcaseError(
      `Strict redaction stopped export after detecting ${redacted.summary.total} sensitive value(s).`,
      EXIT.redaction,
    );
  }

  const output = resolve(options.output);
  const inputSummary: ShowcaseResult["input"] = {
    path: parsed.inputLabel,
    format: parsed.sourceFormat,
    events: parsed.events.length,
    subagents: parsed.subagentCount,
  };
  if (options.dryRun) {
    return {
      schemaVersion: 1,
      success: true,
      dryRun: true,
      input: inputSummary,
      scenes: redacted.moments.map(({ kind, eyebrow, title }) => ({
        kind,
        eyebrow,
        title,
      })),
      artifacts: [],
      redactions: redacted.summary,
      warnings,
      durationMs: Math.round(performance.now() - started),
    };
  }

  let rendered;
  try {
    rendered = await renderAssets(
      redacted.moments,
      redacted.title,
      options.theme,
      options.format,
    );
  } catch (error) {
    throw new ShowcaseError("Image rendering failed.", EXIT.render, {
      cause: error,
    });
  }

  const buffers: Array<{
    type: ArtifactResult["type"];
    name: string;
    mime: string;
    data: Buffer;
  }> = [
    ...(rendered.webp
      ? [
          {
            type: "animated-webp" as const,
            name: "hero.webp",
            mime: "image/webp",
            data: rendered.webp,
          },
        ]
      : []),
    ...(rendered.gif
      ? [
          {
            type: "animated-gif" as const,
            name: "hero.gif",
            mime: "image/gif",
            data: rendered.gif,
          },
        ]
      : []),
    {
      type: "poster",
      name: "poster.png",
      mime: "image/png",
      data: rendered.poster,
    },
    {
      type: "social-preview",
      name: "social-preview.png",
      mime: "image/png",
      data: rendered.socialPreview,
    },
    {
      type: "readme-snippet",
      name: "README-snippet.md",
      mime: "text/markdown",
      data: Buffer.from(readmeSnippet(options.format)),
    },
    {
      type: "manifest",
      name: "showcase.manifest.json",
      mime: "application/json",
      data: Buffer.from(
        manifest(inputSummary, redacted.moments, redacted.summary, warnings),
      ),
    },
  ];
  const paths = buffers.map((item) => join(output, item.name));
  await assertWritable(paths, options.overwrite);
  await mkdir(output, { recursive: true });
  await Promise.all(
    buffers.map((item) =>
      writeFile(
        join(output, item.name),
        item.data,
        options.overwrite ? undefined : { flag: "wx" },
      ),
    ),
  );

  return {
    schemaVersion: 1,
    success: true,
    dryRun: false,
    input: inputSummary,
    scenes: redacted.moments.map(({ kind, eyebrow, title }) => ({
      kind,
      eyebrow,
      title,
    })),
    artifacts: buffers.map((item) => ({
      type: item.type,
      path: join(output, item.name),
      mime: item.mime,
      bytes: item.data.length,
    })),
    redactions: redacted.summary,
    warnings,
    durationMs: Math.round(performance.now() - started),
  };
}

export async function writeJsonResult(
  path: string,
  result: ShowcaseResult,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`);
}
