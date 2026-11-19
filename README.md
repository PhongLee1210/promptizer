<div align="center">

<img src="public/icon/128.png" alt="Promptizer" width="96" height="96">

# Promptizer

**Clearer prompts. Same intent.**

Promptizer rewrites the prompt you are already typing into one clean, professional paragraph —
on-device first, always as an editable preview, never auto-submitted.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Chrome 138+](https://img.shields.io/badge/Chrome-138%2B-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/ai/built-in)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853)](https://developer.chrome.com/docs/extensions/develop/migrate)
[![Built with WXT](https://img.shields.io/badge/Built%20with-WXT-67D4F8)](https://wxt.dev)

<img src="docs/assets/banner.png" alt="Promptizer — clearer prompts, same intent" width="760">

</div>

---

## What it does

You type a rushed prompt into any text composer on the web. Click the Promptizer chip next to it.
Promptizer shows a rewritten version. Keep it, or dismiss it. Your words, clarified — not reinterpreted.

```
before:  make contact button sticky but dont change existing design

after:   Make the contact button sticky on scroll while preserving the
         existing design, spacing, and styling of the current layout.
```

## Why it is different

|                               |                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| **On-device first**           | Chrome's built-in Gemini Nano runs the rewrite locally. Nothing leaves the machine in the default path. |
| **Preview, never submit**     | The rewrite lands in an editable preview. Promptizer never presses send for you.                        |
| **Intent preserved**          | Constraints, tone, and task stay. It cleans the wording, it does not invent requirements.               |
| **No telemetry**              | No prompt logging, no page scraping, no analytics.                                                      |
| **Zero runtime dependencies** | No UI framework, no third-party runtime JavaScript.                                                     |

## How it works

```
  any site's text composer
            |
            |  click the Promptizer chip
            v
  +---------------------+
  |  content script     | -----> Gemini Nano (Chrome built-in AI, on-device)
  |  editable preview   |
  +---------------------+
            ^
            |
       Replace / Dismiss
```

Gemini Nano runs the rewrite entirely on-device. No hosted backend, no cloud fallback.

## Install

Requirements: Chrome 138+, Node.js, [pnpm](https://pnpm.io) 10, `jq`.

```bash
pnpm install
make build-ext            # -> .output/chrome-mv3/
```

1. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `.output/chrome-mv3/`.
2. Open Promptizer settings from the toolbar → **Check or download Gemini Nano** → wait for **Ready on this device**.
3. On any site, type at least 8 characters into a text field, click the Promptizer chip, then **Replace** or **Dismiss**.

## Development

```bash
pnpm dev              # WXT dev server with hot reload
pnpm run test         # vitest
pnpm run test:e2e     # Puppeteer E2E suite against a real built extension
make verify           # vitest + typecheck + prettier + build
make format           # prettier --write
```

Always pnpm — never `npm install`, never `npx`. Full working rules in [AGENTS.md](AGENTS.md).

## Releases

`package.json` holds the version. The tag must match it, or the release build fails.

```bash
pnpm version 0.2.0            # bumps package.json, commits, creates tag v0.2.0
git push origin main --follow-tags
```

Pushing the tag runs [.github/workflows/release.yml](.github/workflows/release.yml): it zips the
extension, writes `checksums.txt`, and publishes the GitHub release. Notes are
[.github/RELEASE.md](.github/RELEASE.md)
followed by the changelog GitHub generates from merged pull requests.

Build the zip locally with `pnpm exec wxt zip`.

## Privacy

Only the prompt and context you explicitly select are processed. Gemini Nano keeps them on-device.
A cloud provider only sees your prompt if you add that provider's API key yourself. No prompt
logging, no page scraping, no automatic submission.

## Contributing

One change per branch and pull request. Run `make verify` before opening it. Ask before adding a
dependency, renaming files, or touching global configuration.

## License

[MIT](LICENSE) © PhongLee1210
