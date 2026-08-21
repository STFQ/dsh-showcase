# DSH plugin

`dsh-session-showcase` exposes the standalone renderer as a native DeepSeek Harness tool plugin.

## Install

After the plugin change is merged into the repository, install it into the DSH profile you use:

```bash
dsh plugin --profile <profile> add github:STFQ/dsh-showcase
```

When the public package is published, the equivalent registry install is:

```bash
dsh plugin --profile <profile> add dsh-session-showcase
```

The repository currently provides the GitHub install path; publishing to npm still requires the maintainer's npm credentials.

For local development, install the checkout instead:

```bash
npm install
npm run build
dsh plugin --profile <profile> add .
```

The package also contains the DSH bundle patch at [`../cordis.patch.yml`](../cordis.patch.yml). Git-based installation builds the package from source through its `prepare` script, so `dist/plugin.js` is included in the loaded bundle.

## Tool contract

The plugin registers one tool: `dsh_showcase`.

| Argument     | Required | Meaning                                                         |
| ------------ | -------- | --------------------------------------------------------------- |
| `input_path` | yes      | Local DSH export ZIP, `session.jsonl`, or `session.jsonl.zstd`. |
| `output_dir` | no       | Output directory; defaults to `.dsh/showcase`.                  |
| `format`     | no       | `webp`, `gif`, or `both`; defaults to `webp`.                   |
| `theme`      | no       | `deepsea`, `midnight`, or `paper`; defaults to `deepsea`.       |
| `redact`     | no       | `auto`, `strict`, or `off`; defaults to `auto`.                 |
| `title`      | no       | Optional cover title.                                           |
| `max_scenes` | no       | Total scenes including the cover, from 2 to 8; defaults to 5.   |
| `overwrite`  | no       | Replace known generated files when `true`.                      |
| `dry_run`    | no       | Inspect and redact without writing artifacts.                   |

The result includes the resolved input/output display paths, scene count, redaction count, and generated artifact paths. Its stable shape is described by [`../schemas/plugin-result.schema.json`](../schemas/plugin-result.schema.json). The plugin refuses inputs larger than 64 MiB, does not execute anything from the imported session, and does not make model or network calls.

## Filesystem boundary

Input resolution, metadata checks, and byte reads go through DSH's `ctx.fs` provider. Generated binary assets are rendered by the existing local core and written to the resolved local provider path. The default local DSH profile is the supported deployment; a remote or restricted filesystem provider may reject binary output according to its own policy.

## Registry and listing status

DSH's plugin mechanism installs packages from a local path, GitHub, or npm. It does not automatically publish every plugin to a single official central catalog. This repository is therefore the installable source package; a separate community “awesome plugins” list, if desired, requires a pull request to that list after this plugin is merged and released.

## 中文说明

这个插件注册一个 `dsh_showcase` 工具：读取本地 DSH 导出的 ZIP、JSONL 或 Zstandard 日志，默认自动脱敏，然后在工作区生成 WebP/GIF、封面图、README 片段和清单。插件不执行导入会话里的工具，不上传数据，也不调用模型。

本地开发时先在仓库目录执行 `npm install && npm run build`，再用 `dsh plugin --profile <profile> add .` 安装。正式使用时可直接从 GitHub 安装：`dsh plugin --profile <profile> add github:STFQ/dsh-showcase`。
