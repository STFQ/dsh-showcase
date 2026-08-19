# AGENTS.md

## Product invariants

- Runtime conversion is local-only: no network, telemetry, model, or API calls.
- Never execute content from a session, tool call, ZIP, or attachment.
- Redaction defaults to `auto`; reasoning and request headers never become scenes.
- Render from a sanitized intermediate `Moment[]`, never directly from raw events.
- `--json` stdout is machine-only. Diagnostics belong on stderr.
- Never delete an output directory. `--overwrite` may replace only fixed generated filenames.
- Fixtures are synthetic and must not contain a real user session or credential.

## Repository map

| Path             | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `src/parser.ts`  | ZIP/raw/Zstd input and packed-row adapter        |
| `src/moments.ts` | Semantic event selection and reasoning exclusion |
| `src/redact.ts`  | Sanitization rules and counts                    |
| `src/render.ts`  | Deterministic SVG → WebP/GIF/PNG rendering       |
| `src/cli.ts`     | Public CLI/help/exit-code contract               |
| `schemas/`       | Machine-readable stable output contract          |
| `examples/`      | Synthetic DSH-shaped fixtures                    |
| `docs/`          | CLI, format, security, and design references     |

## Commands

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run demo
npm run pack:check
npm run check
```

Use Node.js 22.19 or newer. `npm run check` is the release gate.

## Change synchronization

| When changing           | Also update                                                                      |
| ----------------------- | -------------------------------------------------------------------------------- |
| CLI flag/help/exit code | `docs/cli.md`, both README language sections, CLI tests, changelog               |
| Result JSON             | `schemas/result.schema.json`, tests, `docs/cli.md`, schema version when breaking |
| DSH format adapter      | `docs/session-format.md`, pinned-source link, parser fixtures/tests              |
| Redaction rule          | `docs/security.md`, tests; never add a real secret fixture                       |
| Generated artifact set  | README output trees, CLI help, result schema, smoke tests                        |
| User-visible behavior   | English and Chinese README sections, changelog                                   |
| Package version         | `package.json`, `src/meta.ts`, lockfile, changelog, release tag                  |

## Generated assets

`assets/hero.webp`, `assets/hero.gif`, `assets/poster.png`, and `assets/social-preview.png` must be produced by the released CLI from `examples/session.jsonl`. Do not edit binary outputs manually.

## Security review

Check archive limits, path handling, SVG escaping, secret propagation into manifests, stdout purity, and output conflicts for every parser/renderer change. Fail closed on malformed committed data. Prefer a warning only for explicit best-effort compatibility cases documented in `docs/session-format.md`.
