# Security and privacy model

`dsh-showcase` processes potentially sensitive agent transcripts. Its primary security boundary is local, non-executing conversion.

## Guarantees

- No network request is made by the runtime.
- No AI model or API is called.
- Session tools, commands, code, and attachments are never executed.
- ZIP content is read in memory and is not extracted to disk.
- Request headers and reasoning content are excluded from scene selection.
- User-derived text is XML-escaped before SVG rendering.
- Generated filenames are fixed; `--overwrite` never deletes a directory.
- Raw input is never copied into the output directory.

## Redaction modes

`auto` (default) replaces known patterns and reports counts. `strict` stops before rendering or writing if a pattern is detected. `off` emits a warning.

Current rules cover common provider keys, GitHub tokens, AWS access-key IDs, JWTs, bearer tokens, credential-like assignments, email addresses, credentialed URLs, and Windows/macOS/Linux home paths.

## Limits

Pattern-based redaction cannot recognize every private value. Repository names, proprietary code, internal hostnames, personal names, business data, and novel secret formats may remain. Always inspect `hero.*`, `poster.png`, and `showcase.manifest.json` before publishing.

The 64 MiB compressed-input and 128 MiB decompressed-text limits reduce accidental memory exhaustion. They are not a complete hostile-archive sandbox; do not process untrusted files in a privileged environment.

## Vulnerability reports

Follow [../SECURITY.md](../SECURITY.md). Do not attach a real private session or secret to a public issue. Use a minimal synthetic reproduction.
