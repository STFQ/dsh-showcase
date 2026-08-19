# DeepSeek Harness session compatibility

This adapter was verified against DeepSeek Harness `dsh-v0.1.0-rc.8`, commit [`141eb6f`](https://github.com/deepseek-ai/deepseek-harness/commit/141eb6fef83422698aef7a981029e843e8161534). DSH is a developer preview and explicitly does not promise broad session-format compatibility yet.

## Supported containers

| Container            | Support                       | Source contract                                                                                                                                                                  |
| -------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Official export ZIP  | Yes; root session             | [`session-export.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/host/apiproxy/src/session-export.ts)                |
| Raw `session.jsonl`  | Yes                           | [`format.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/session/session-persistence-jsonl/src/format.ts)            |
| `session.jsonl.zstd` | Yes; complete frames          | [`zstd.ts`](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/session/session-persistence-jsonl/src/zstd.ts)                |
| SQLite persistence   | No export adapter in DSH rc.8 | [`session-log-export` README](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/session-query/session-log-export/README.md) |

The official ZIP uses `session.jsonl` at the root, optional descendant logs below `subagents/<id>/session.jsonl`, and referenced images below `media/`. Version 0.1 selects only the root and reports how many descendant logs are present.

## Logical records

The first JSONL record is a session header. Later records are event envelopes with `type`, `seq`, `time`, and `data`. `dsh-showcase` extracts these presentation events:

- `user/message` from a direct human source;
- `tool/call`;
- `tool/result`, with diff-like metadata preferred;
- `assistant/message`;
- `assistant/chunk` text only as a fallback when no assembled message exists.

It intentionally excludes request headers, system/tools prompts, reasoning deltas/blocks, and plugin snapshots from scene selection.

## Packed chunk rows

DSH can pack token deltas into `text-chunks`, `reasoning-chunks`, and `tool-call-chunks` storage rows. The reader expands their sequence/time gaps according to the [official storage codec](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/core/session/src/chunk-rows.ts).

## Zstandard frames

DSH stores the header and each durable append batch as independent checksummed Zstandard frames. A one-shot decompressor reads only one frame, so `dsh-showcase` first scans frame boundaries and then validates/decompresses each complete frame. An incomplete final frame is ignored with a warning; corrupt complete frames fail closed.

## Compatibility policy

- The adapter reports the observed session version and warns on a version other than v0.
- New event vocabulary is tolerated because showcase generation is a read-only projection, not session reconstruction.
- Malformed JSON, malformed packed rows, invalid Zstandard structures, and missing ZIP roots are rejected.
- Every upstream release is tested with a pinned synthetic/official-shaped fixture before compatibility claims change.
