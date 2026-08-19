# Contributing

Thanks for helping make DSH demos safer and easier to share.

## Setup

Use Node.js 22.19 or newer:

```bash
npm install
npm run check
```

Run `npm run demo` after a successful build to regenerate a local demonstration from the synthetic fixture.

## Pull requests

- Keep the runtime local-only and zero-model-call.
- Add focused tests for every behavior change.
- Update both English and Chinese README sections for user-visible behavior.
- Pin DSH format claims to an upstream commit.
- Use only synthetic fixtures; never commit a real session, private path, or credential.
- Include a changelog entry for public behavior changes.

Before opening a PR, run `npm run check`. PRs should explain what changed, why it matters, security/privacy impact, and verification performed.
