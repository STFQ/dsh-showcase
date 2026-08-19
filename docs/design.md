# Design sources and decisions

`dsh-showcase` deliberately builds on documented community contracts.

## DeepSeek Harness

- [Event-sourced session types](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/core/session/src/types.ts)
- [Packed chunk codec](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/core/session/src/chunk-rows.ts)
- [JSONL persistence format](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/session/session-persistence-jsonl/src/format.ts)
- [Concatenated Zstandard framing](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/session/session-persistence-jsonl/src/zstd.ts)
- [Official export ZIP layout](https://github.com/deepseek-ai/deepseek-harness/blob/141eb6fef83422698aef7a981029e843e8161534/packages/host/apiproxy/src/session-export.ts)

The Zstandard frame scanner is adapted from the MIT-licensed upstream implementation; attribution is retained in source and in [../THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## CLI and documentation conventions

- [Command Line Interface Guidelines](https://clig.dev/) informed stdout/stderr separation, composable stdin, examples-first help, and stable exit status.
- [Prettier CLI](https://prettier.io/docs/cli/) informed explicit write/overwrite behavior.
- [Wrangler](https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler) informed quick-start-first documentation and precise runtime requirements.
- [Vercel ai-cli](https://github.com/vercel-labs/ai-cli) informed machine-clean `--json` output and agent-oriented examples.
- [AGENTS.md](https://agents.md/) and [llms.txt](https://llmstxt.org/) define the two agent entry points used here.

## Visual storytelling references

- [VHS](https://github.com/charmbracelet/vhs) demonstrates deterministic, code-defined demo rendering.
- [Terminalizer](https://github.com/faressoft/terminalizer) demonstrates editable event timing and README-oriented animation output.
- [asciinema](https://github.com/asciinema/asciinema) demonstrates a small event-stream model; no GPL code is used.

Unlike terminal recorders, `dsh-showcase` renders semantic DSH events. Unlike replay/debugging viewers, it selects a small launch-ready narrative and produces fixed artifacts suitable for GitHub.
