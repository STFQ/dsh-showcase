import { spawnSync } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this check through npm run pack:smoke.");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function runNpm(args, cwd) {
  return run(process.execPath, [npmCli, ...args], cwd);
}

const scratch = await mkdtemp(join(tmpdir(), "dsh-showcase-pack-"));
try {
  const cache = join(scratch, "npm-cache");
  const packJson = runNpm(
    [
      "pack",
      "--json",
      "--ignore-scripts",
      "--pack-destination",
      scratch,
      "--cache",
      cache,
    ],
    root,
  );
  const packed = JSON.parse(packJson);
  const filename = packed[0]?.filename;
  if (typeof filename !== "string")
    throw new Error("npm pack returned no filename");

  const installRoot = join(scratch, "install");
  await mkdir(installRoot);
  await writeFile(join(installRoot, "package.json"), '{"private":true}\n');
  runNpm(
    [
      "install",
      join(scratch, filename),
      "--cache",
      cache,
      "--ignore-scripts=false",
    ],
    installRoot,
  );

  const installed = join(installRoot, "node_modules", "dsh-session-showcase");
  const fixture = join(installed, "examples", "session.jsonl");
  await access(join(installed, "assets", "hero.webp"));
  await access(join(installed, "AGENTS.md"));
  await access(join(installed, "schemas", "manifest.schema.json"));
  await access(join(installed, "dist", "plugin.js"));
  await access(join(installed, "cordis.patch.yml"));
  await access(fixture);

  const installedPackage = JSON.parse(
    await readFile(join(installed, "package.json"), "utf8"),
  );
  if (installedPackage.dsh?.bundle?.patch !== "./cordis.patch.yml") {
    throw new Error("Package does not expose the DSH bundle patch.");
  }

  const version = runNpm(
    ["exec", "--prefix", installRoot, "--", "dsh-showcase", "--version"],
    installRoot,
  ).trim();
  const packageVersion = installedPackage.version;
  if (version !== packageVersion)
    throw new Error(
      `CLI version ${version} does not match package ${packageVersion}`,
    );

  const output = join(scratch, "output");
  runNpm(
    [
      "exec",
      "--prefix",
      installRoot,
      "--",
      "dsh-showcase",
      fixture,
      "--output",
      output,
      "--format",
      "webp",
      "--overwrite",
      "--json",
    ],
    installRoot,
  );
  await access(join(output, "hero.webp"));
  await access(join(output, "showcase.manifest.json"));
  process.stdout.write(
    `Verified ${filename} from package install through rendered output.\n`,
  );
} finally {
  await rm(scratch, { recursive: true, force: true });
}
