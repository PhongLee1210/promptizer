<div align="center">

<img src="apps/chrome-extension/public/icon/128.png" alt="Promptizer" width="96" height="96">

# Promptizer

**Clearer prompts. Same intent.**

Promptizer rewrites the prompt you are already typing into one clean, professional paragraph —
on-device, always as an editable preview, never auto-submitted.

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

|                               |                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| **On-device rewrites**        | Gemini Nano runs every rewrite locally. Signed out, the extension makes no network calls. |
| **Preview, never submit**     | The rewrite lands in an editable preview. Promptizer never presses send for you.          |
| **Intent preserved**          | Constraints, tone, and task stay. It cleans the wording, it does not invent requirements. |
| **No telemetry**              | No prompt logging, no page scraping, no analytics.                                        |
| **Zero runtime dependencies** | No UI framework, no third-party runtime JavaScript.                                       |

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

Requirements: Chrome 138+, Node.js 22, [pnpm](https://pnpm.io) 10, `jq`.

```bash
pnpm install
make build-ext            # -> apps/chrome-extension/.output/chrome-mv3/
```

1. Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select
   `apps/chrome-extension/.output/chrome-mv3/`.
2. Open Promptizer settings from the toolbar → **Setup guide** → **Download model** → wait for **Ready**.
3. On any site, type into a text field, click the Promptizer chip, then **Replace** or **Dismiss**.

## Use the extension

Focus any prose field and the chip appears inside it. Click it for the action rail: **Refine prompt**
(**Improve writing** in a plain textarea), **Fix grammar**, **Shorten**, **Translate** to Vietnamese or
English, and **Change tone** to professional, friendly or direct.

The result opens as an editable preview — copy it, edit it, tweak it with another action, or step back
through the last ten. Only **Replace** writes to your field, and the chip offers an undo for six
seconds afterwards. `Esc` leaves your text alone.

The chip never appears on passwords, one-time codes or card fields, so it cannot read them.

Every action and journey in detail: [docs/features.md](docs/features.md).

## Documentation

[Features](docs/features.md) · [Architecture](docs/architecture.md) ·
[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) ·
[Release checklist](docs/release-checklist.md)

## Development

The monorepo foundation is in place: the extension lives in `apps/chrome-extension/`, and `packages/`
holds shared design tokens, types, translations and configuration. Run checks from the repository root.
The dashboard, backend and account sync are future work. See [Contributing](CONTRIBUTING.md#where-things-live)
for the layout.

Before the first E2E run, install Chrome for Testing:
`pnpm -C apps/chrome-extension exec puppeteer browsers install chrome`.

```bash
pnpm -C apps/chrome-extension dev  # WXT dev server with hot reload
pnpm run test         # Puppeteer E2E suite
pnpm run test:e2e     # Puppeteer E2E suite against a real built extension
make verify           # typecheck + prettier + build + E2E
make format           # prettier --write
```

Always pnpm — never `npm install`, never `npx`. Full working rules in [AGENTS.md](AGENTS.md).

## Releases

`apps/chrome-extension/package.json` holds the version. The tag must match it, or the release build fails.

```bash
pnpm -C apps/chrome-extension version 0.2.0  # bumps the version, commits, creates tag v0.2.0
git push origin main --follow-tags
```

Pushing the tag runs [.github/workflows/release.yml](.github/workflows/release.yml): it zips the
extension, writes `checksums.txt`, and publishes the GitHub release. Notes are
[.github/RELEASE.md](.github/RELEASE.md)
followed by the changelog GitHub generates from merged pull requests.

Build the zip locally with `pnpm -C apps/chrome-extension run zip`.

## Privacy

Only the text you run an action on is processed, and Gemini Nano keeps it on-device. Rewrites never
leave the machine. Signed out, the extension makes no network requests at all. If you choose to sign in
from the popup's Account screen, the popup talks to your Promptizer account service (`apps/web`) to sign
in, check and renew the session and sign out, and the session is kept in the extension's local storage until you
sign out. Permissions are `storage` and `activeTab` only, with no host permissions,
asserted on every build. Password, one-time-code and payment fields never get a chip, so their
contents are never read. No prompt logging, no page scraping, no automatic submission.

## Contributing

One change per branch and pull request. Run `make verify` before opening it. Ask before adding a
dependency, renaming files, or touching global configuration. Full guide in
[CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © PhongLee1210
