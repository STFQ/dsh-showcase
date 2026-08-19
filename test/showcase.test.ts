import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createShowcase } from "../src/index.js";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE = join(ROOT, "examples", "session.jsonl");

describe("createShowcase", () => {
  it("renders real WebP/GIF/PNG artifacts and a secret-free manifest", async () => {
    const output = await mkdtemp(join(tmpdir(), "dsh-showcase-output-"));
    const result = await createShowcase({
      input: FIXTURE,
      output,
      format: "both",
      theme: "deepsea",
      redact: "auto",
      maxScenes: 5,
      dryRun: false,
      overwrite: false,
    });
    expect(result.redactions.total).toBeGreaterThanOrEqual(3);
    expect(result.input.path).toBe("session.jsonl");
    expect(await readdir(output)).toEqual(
      expect.arrayContaining([
        "hero.webp",
        "hero.gif",
        "poster.png",
        "social-preview.png",
        "README-snippet.md",
        "showcase.manifest.json",
      ]),
    );
    const webp = await readFile(join(output, "hero.webp"));
    const gif = await readFile(join(output, "hero.gif"));
    const png = await readFile(join(output, "poster.png"));
    expect(webp.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(gif.subarray(0, 3).toString("ascii")).toBe("GIF");
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    const manifest = await readFile(
      join(output, "showcase.manifest.json"),
      "utf8",
    );
    expect(manifest).not.toContain("demo@example.com");
    expect(manifest).not.toContain("sk-demo");
    expect(manifest).not.toContain("cavalier");
  }, 30_000);

  it("supports dry-run without creating an output directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "dsh-showcase-dry-"));
    const output = join(root, "not-created");
    const result = await createShowcase({
      input: FIXTURE,
      output,
      format: "webp",
      theme: "paper",
      redact: "auto",
      maxScenes: 5,
      dryRun: true,
      overwrite: false,
    });
    expect(result.dryRun).toBe(true);
    expect(result.artifacts).toEqual([]);
    await expect(readdir(output)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("fails closed in strict redaction mode before writing", async () => {
    const output = await mkdtemp(join(tmpdir(), "dsh-showcase-strict-"));
    await expect(
      createShowcase({
        input: FIXTURE,
        output,
        format: "webp",
        theme: "deepsea",
        redact: "strict",
        maxScenes: 5,
        dryRun: false,
        overwrite: false,
      }),
    ).rejects.toMatchObject({ exitCode: 3 });
    expect(await readdir(output)).toEqual([]);
  });
});
