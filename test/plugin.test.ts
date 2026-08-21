import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Context } from "@deepseek-ai/cordis";
import { describe, expect, it } from "vitest";
import { apply, name } from "../src/plugin.js";

const ROOT = new URL("../", import.meta.url);
const FIXTURE = new URL("../examples/session.jsonl", import.meta.url);

interface RegisteredTool {
  readonly name: string;
  readonly execute: (
    args: unknown,
    exec: unknown,
  ) => Promise<{
    readonly output_dir: string;
    readonly scene_count: number;
    readonly redactions: number;
    readonly artifacts: string[];
  }>;
}

describe("dsh plugin", () => {
  it("registers the showcase tool and its DSH-facing contract", () => {
    const tools: RegisteredTool[] = [];
    const sections: unknown[] = [];
    const ctx = {
      systemPrompt: { section: (section: unknown) => sections.push(section) },
      tools: { register: (tool: RegisteredTool) => tools.push(tool) },
    } as unknown as Context;

    apply(ctx);

    expect(name).toBe("dsh-session-showcase");
    expect(sections).toHaveLength(1);
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("dsh_showcase");
  });

  it("reads input through ctx.fs and produces local artifacts", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "dsh-plugin-output-"));
    const fixture = new Uint8Array(await readFile(FIXTURE));
    const tools: RegisteredTool[] = [];
    const inputPath = "session.jsonl";
    const outputPath = join(outputRoot, "showcase");
    const ctx = {
      systemPrompt: { section: () => undefined },
      tools: { register: (tool: RegisteredTool) => tools.push(tool) },
      fs: {
        resolve: async (target: string) =>
          target === inputPath
            ? { displayPath: target, absolutePath: FIXTURE.pathname }
            : { displayPath: target, absolutePath: outputPath },
        stat: async () => ({ size: fixture.byteLength }),
        readBytes: async () => fixture,
        processPath: (target: { absolutePath: string }) => target.absolutePath,
      },
    } as unknown as Context;

    apply(ctx);
    const result = await tools[0]!.execute(
      { input_path: inputPath, output_dir: "showcase", format: "webp" },
      {
        signal: new AbortController().signal,
        agent: { session: { header: { cwd: ROOT.pathname } } },
      },
    );

    expect(result.output_dir).toBe("showcase");
    expect(result.scene_count).toBeGreaterThanOrEqual(2);
    expect(result.redactions).toBeGreaterThan(0);
    expect(
      result.artifacts.some((artifact) =>
        artifact.replaceAll("\\", "/").endsWith("/hero.webp"),
      ),
    ).toBe(true);
    expect(await readdir(outputPath)).toEqual(
      expect.arrayContaining(["hero.webp", "showcase.manifest.json"]),
    );
  }, 30_000);

  it("rejects missing and oversized inputs before reading or rendering", async () => {
    const tools: RegisteredTool[] = [];
    const ctx = {
      systemPrompt: { section: () => undefined },
      tools: { register: (tool: RegisteredTool) => tools.push(tool) },
      fs: {
        resolve: async (target: string) => ({ displayPath: target }),
        stat: async (target: { displayPath: string }) =>
          target.displayPath === "missing"
            ? undefined
            : { size: 64 * 1024 * 1024 + 1 },
        readBytes: async () => {
          throw new Error("readBytes should not run for rejected input");
        },
      },
    } as unknown as Context;

    apply(ctx);
    const exec = {
      signal: new AbortController().signal,
      agent: { session: { header: {} } },
    };
    await expect(
      tools[0]!.execute({ input_path: "missing" }, exec),
    ).rejects.toThrow("Input does not exist: missing");
    await expect(
      tools[0]!.execute({ input_path: "oversized" }, exec),
    ).rejects.toThrow("Input exceeds the 64 MiB safety limit.");
  });
});
