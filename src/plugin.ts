import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import type {} from "@deepseek-ai/dsh-fs";
import { basename, join } from "node:path";
import { createShowcase } from "./index.js";
import type { OutputFormat, RedactMode, ThemeName } from "./types.js";

export const name = "dsh-session-showcase";
export const inject = ["tools", "fs"];

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const DEFAULT_OUTPUT = ".dsh/showcase";

interface ToolExecutionContext {
  readonly signal: AbortSignal;
  readonly agent?: {
    readonly session: {
      readonly header: { readonly cwd?: string };
    };
  };
}

interface ShowcaseArgs {
  input_path: string;
  output_dir?: string;
  format?: OutputFormat;
  theme?: ThemeName;
  redact?: RedactMode;
  title?: string;
  max_scenes?: number;
  overwrite?: boolean;
  dry_run?: boolean;
}

interface PluginResult {
  readonly input_path: string;
  readonly output_dir: string;
  readonly dry_run: boolean;
  readonly scene_count: number;
  readonly redactions: number;
  readonly artifacts: string[];
}

const outputSchema = {
  type: "object" as const,
  additionalProperties: false as const,
  properties: {
    input_path: { type: "string" as const, required: true as const },
    output_dir: { type: "string" as const, required: true as const },
    dry_run: { type: "boolean" as const, required: true as const },
    scene_count: { type: "integer" as const, required: true as const },
    redactions: { type: "integer" as const, required: true as const },
    artifacts: {
      type: "array" as const,
      required: true as const,
      items: { type: "string" as const },
    },
  },
} as const;

function sessionCwd(exec: ToolExecutionContext): string | undefined {
  return exec.agent?.session.header.cwd;
}

function validateMaxScenes(value: number | undefined): number {
  const maxScenes = value ?? 5;
  if (!Number.isSafeInteger(maxScenes) || maxScenes < 2 || maxScenes > 8) {
    throw new Error("max_scenes must be an integer from 2 to 8");
  }
  return maxScenes;
}

function renderResult(value: PluginResult): { type: "text"; text: string }[] {
  const lines = [
    value.dry_run
      ? `Planned ${value.scene_count} scenes.`
      : `Created ${value.scene_count} scenes.`,
    `Output: ${value.output_dir}`,
  ];
  if (value.artifacts.length > 0) {
    lines.push(...value.artifacts.map((artifact) => `- ${artifact}`));
  }
  if (value.redactions > 0) {
    lines.push(`Redacted ${value.redactions} sensitive value(s).`);
  }
  return [{ type: "text", text: lines.join("\n") }];
}

async function executeShowcase(
  ctx: Context,
  args: ShowcaseArgs,
  exec: ToolExecutionContext,
): Promise<PluginResult> {
  const cwd = sessionCwd(exec);
  const inputTarget = await ctx.fs.resolve(args.input_path, {
    ...(cwd ? { cwd } : {}),
    signal: exec.signal,
  });
  const inputInfo = await ctx.fs.stat(inputTarget, exec.signal);
  if (inputInfo === undefined) {
    throw new Error(`Input does not exist: ${inputTarget.displayPath}`);
  }
  if (inputInfo.size !== undefined && inputInfo.size > MAX_INPUT_BYTES) {
    throw new Error("Input exceeds the 64 MiB safety limit.");
  }
  const input = await ctx.fs.readBytes(
    inputTarget,
    exec.signal,
    MAX_INPUT_BYTES,
  );

  const outputTarget = await ctx.fs.resolve(args.output_dir ?? DEFAULT_OUTPUT, {
    ...(cwd ? { cwd } : {}),
    signal: exec.signal,
  });
  const result = await createShowcase({
    input,
    inputLabel: inputTarget.displayPath,
    output: ctx.fs.processPath(outputTarget),
    format: args.format ?? "webp",
    theme: args.theme ?? "deepsea",
    redact: args.redact ?? "auto",
    ...(args.title ? { title: args.title } : {}),
    maxScenes: validateMaxScenes(args.max_scenes),
    dryRun: args.dry_run ?? false,
    overwrite: args.overwrite ?? false,
  });

  return {
    input_path: inputTarget.displayPath,
    output_dir: outputTarget.displayPath,
    dry_run: result.dryRun,
    scene_count: result.scenes.length + 1,
    redactions: result.redactions.total,
    artifacts: result.artifacts.map((artifact) =>
      join(outputTarget.displayPath, basename(artifact.path)),
    ),
  };
}

export function apply(ctx: Context): void {
  ctx.systemPrompt.section({
    name: "tool:dsh-session-showcase",
    order: 120,
    text:
      "Use dsh_showcase after a session export when the user wants a README-ready " +
      "animated demo. It runs locally, never uploads the session, never executes " +
      "session tools, and redacts common secrets by default.",
  });

  ctx.tools.register(
    defineTool({
      name: "dsh_showcase",
      description:
        "Render a DSH session export into a redacted README-ready animated demo, poster, social preview, snippet, and manifest.",
      parameters: {
        input_path: {
          type: "string",
          required: true,
          description:
            "Path to an official DSH session ZIP, session.jsonl, or session.jsonl.zstd.",
        },
        output_dir: {
          type: "string",
          description: `Directory for generated artifacts. Defaults to ${DEFAULT_OUTPUT}.`,
        },
        format: {
          type: "string",
          enum: ["webp", "gif", "both"],
          description: "Animated output format. Defaults to webp.",
        },
        theme: {
          type: "string",
          enum: ["deepsea", "midnight", "paper"],
          description: "Visual theme. Defaults to deepsea.",
        },
        redact: {
          type: "string",
          enum: ["auto", "strict", "off"],
          description: "Secret handling policy. Defaults to auto.",
        },
        title: {
          type: "string",
          description: "Optional cover title override.",
        },
        max_scenes: {
          type: "integer",
          description: "Total scenes including the cover, from 2 to 8.",
        },
        overwrite: {
          type: "boolean",
          description: "Replace known generated artifacts when true.",
        },
        dry_run: {
          type: "boolean",
          description: "Plan and redact without writing artifacts.",
        },
      },
      output: {
        schema: outputSchema,
        render: (_args, value) =>
          renderResult(value as unknown as PluginResult),
      },
      async execute(args, exec) {
        return executeShowcase(ctx, args as ShowcaseArgs, exec);
      },
    }),
  );
}
