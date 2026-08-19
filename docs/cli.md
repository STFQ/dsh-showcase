# CLI reference

## Synopsis

```text
dsh-showcase <session.jsonl|session.jsonl.zstd|dsh-session.zip|-> [options]
```

The CLI has one operation: convert a DeepSeek Harness session into shareable visual artifacts. It is non-interactive and safe to use in CI.

## Input

The positional argument accepts:

- an official DSH session export ZIP;
- raw JSONL;
- DSH concatenated-frame Zstandard JSONL;
- `-` for standard input.

Standard input examples:

```bash
# POSIX shells, Git Bash, and PowerShell's cat alias
cat session.jsonl | dsh-showcase - --dry-run --json

# Native Windows cmd.exe
type session.jsonl | dsh-showcase - --dry-run --json
```

Input is read-only. ZIP entries are processed in memory and never extracted to disk. The compressed input limit is 64 MiB and the decompressed session-text limit is 128 MiB.

## Options

| Option                               |               Default | Contract                                                                                     |
| ------------------------------------ | --------------------: | -------------------------------------------------------------------------------------------- |
| `-o, --output <dir>`                 | `dsh-showcase-output` | Directory for generated artifacts.                                                           |
| `--format <webp\|gif\|both>`         |                `webp` | Animated format. Poster and metadata outputs are always generated.                           |
| `--theme <deepsea\|midnight\|paper>` |             `deepsea` | Deterministic visual theme.                                                                  |
| `--redact <auto\|strict\|off>`       |                `auto` | `auto` replaces and reports; `strict` stops before writing when a match exists; `off` warns. |
| `--title <text>`                     |          first prompt | Cover-title override. The value is subject to the selected redaction policy.                 |
| `--max-scenes <2-8>`                 |                   `5` | Total scene count including the cover.                                                       |
| `--dry-run`                          |                   off | Parse, select scenes, and scan redactions without rendering or writing.                      |
| `--overwrite`                        |                   off | Replace only the fixed generated filenames. No directory is deleted.                         |
| `--json`                             |                   off | Emit exactly one JSON result on stdout. Warnings/errors remain on stderr.                    |
| `--quiet`                            |                   off | Suppress human-readable success output. Errors still print.                                  |
| `-h, --help`                         |                       | Print current help.                                                                          |
| `-v, --version`                      |                       | Print the package version.                                                                   |

## Outputs

Depending on `--format`, the output directory contains `hero.webp`, `hero.gif`, or both. It always contains:

- `poster.png` — 1280×720 final scene;
- `social-preview.png` — 1280×640 cover for GitHub's social preview;
- `README-snippet.md` — copy-ready Markdown;
- `showcase.manifest.json` — scene and redaction record processed under the selected redaction policy; see [`../schemas/manifest.schema.json`](../schemas/manifest.schema.json). With `--redact off`, selected source text is intentionally preserved.

Existing files cause exit code 5 unless `--overwrite` is explicit.

## Machine output

With `--json`, stdout contains one object conforming to [`../schemas/result.schema.json`](../schemas/result.schema.json). The input path is reduced to its basename to avoid leaking a local directory; generated artifact paths are absolute. The schema is versioned independently of the package.

Example:

```bash
dsh-showcase session.jsonl --dry-run --json > showcase-plan.json
```

## Exit status

| Code | Meaning                                  |
| ---: | ---------------------------------------- |
|    0 | Success                                  |
|    2 | Invalid/missing input or option          |
|    3 | Strict redaction detected sensitive data |
|    4 | Rendering or encoding failure            |
|    5 | Output conflict without `--overwrite`    |
|  130 | Interrupted                              |

## Stability

Flags, exit codes, and result schema are compatibility surfaces. Changes require a changelog entry, schema update, tests, CLI help update, and corresponding English/Chinese README changes.
