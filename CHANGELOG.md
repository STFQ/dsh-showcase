# Changelog

All notable changes are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic versioning.

## [Unreleased]

## [0.2.0] - 2026-08-21

### Added

- Added a native DSH `dsh_showcase` tool plugin with the official bundle patch manifest.
- Added DSH filesystem-provider input resolution, bounded byte reads, local artifact reporting, and plugin contract tests.
- Renamed the npm package to `dsh-session-showcase` to avoid colliding with an unrelated package that occupied `dsh-showcase`.

### Changed

- Kept the `dsh-showcase` standalone CLI while making the package entry point the DSH plugin.
- Updated README, agent guidance, and technical documentation with GitHub/local plugin installation instructions.

## [0.1.1] - 2026-08-20

### Changed

- Added a zero-setup fixture path so first-time users can render a demo before exporting a real DSH session.
- Added public npm publishing metadata and discovery keywords for the `dsh-showcase` CLI.
- Clarified the npm-first install path with an exact GitHub Release fallback.

## [0.1.0] - 2026-08-20

### Added

- Offline conversion of official DSH export ZIP, raw JSONL, and concatenated Zstandard JSONL.
- Semantic prompt, tool, diff, result, and final-answer scene selection.
- Animated WebP/GIF, poster, social preview, README snippet, and policy-processed manifest outputs.
- Default secret/identity/path redaction with strict and off policies.
- JSON automation output, stdin, dry-run, conflict-safe writes, three visual themes, and stable exit codes.
- Bilingual README and agent-oriented `llms.txt`, `AGENTS.md`, schemas, and format/security references.

[Unreleased]: https://github.com/STFQ/dsh-showcase/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/STFQ/dsh-showcase/releases/tag/v0.2.0
[0.1.1]: https://github.com/STFQ/dsh-showcase/releases/tag/v0.1.1
[0.1.0]: https://github.com/STFQ/dsh-showcase/releases/tag/v0.1.0
