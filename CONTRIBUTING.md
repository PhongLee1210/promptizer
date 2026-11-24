# Contributing

Thanks for looking. Promptizer is a small, deliberately dependency-free Chrome extension, so the bar
for adding anything new is high and the bar for keeping the existing shape is higher.

Read [AGENTS.md](AGENTS.md) first — it holds the binding working rules for this repo, for humans and
coding agents alike. This file is the contributor-facing walkthrough of the same rules.

## Setup

Requirements: Chrome 138+, Node.js 22, [pnpm](https://pnpm.io) 10, `jq`.

```bash
corepack install -g pnpm@10     # stay on 10 — pnpm 11+ breaks the corepack shim
pnpm install
pnpm -C apps/chrome-extension dev  # WXT dev server with hot reload
```

Always pnpm. Never `npm install`, never `npx`, never commit a `package-lock.json`. Run binaries
through `pnpm exec`.

Load the built extension unpacked from `apps/chrome-extension/.output/chrome-mv3/` at `chrome://extensions` with
Developer mode on. Chrome and Edge only.

## Before you open a pull request

```bash
make verify        # typecheck + unit tests + format check + build + manifest assertion
pnpm run test:e2e  # Puppeteer suite against a real build
```

`make verify` must pass. Run the e2e suite too whenever you touch anything in `src/content/`.

## Ask first

Open an issue before you:

- add a dependency — there are **no** third-party runtime dependencies and no UI framework; WXT, Vite,
  Vitest, Puppeteer, Prettier and Turborepo are the permitted dev dependencies;
- rename or move files;
- change global configuration (`wxt.config.ts`, `tsconfig.json`, `pnpm-workspace.yaml`, `turbo.json`, CI
  workflows, the Makefile);
- add a new file where an existing one would do — there is no file or function length limit here, so
  extending `apps/chrome-extension/src/content/controller.ts` beats splitting it.

## Code style

Enforced by Prettier (`.prettierrc.json`): 2 spaces, semicolons, double quotes, trailing commas,
`printWidth` 120. Run `make format`.

Beyond the formatter:

- **No comments.** Names and structure carry the meaning. The rare exception is a _why_ comment for a
  non-obvious workaround or a platform quirk — see `src/content/nano.ts` for the bar.
- `import type` for type-only imports.
- Intention-revealing names. The full naming guidance lives in
  [`.claude/rules/coding-conventions.md`](.claude/rules/coding-conventions.md).
- Never log, print or commit credentials or `.env`.

## Where things live

```
apps/chrome-extension/
  src/content/      content script modules — see docs/architecture.md
  src/popup/        popup screens and state
  src/styles/       surface stylesheets (design tokens live in packages/ui)
  src/entrypoints/  WXT entrypoints (content script, popup)
  modules/          WXT build-time modules
  e2e/              Puppeteer harness, fixtures and tests
  scripts/          icon generation, manifest assertion
packages/
  ui/               design tokens shared across surfaces
  shared/           shared types and constants
  i18n/             typed en dictionary
  config/           shared tsconfig baseline
docs/               architecture, features, release checklist
```

Do not edit `apps/chrome-extension/.output/**`, `apps/chrome-extension/.wxt/**` or
`apps/chrome-extension/src/utils/icons.ts` — all three are generated. Icons come from
`src/assets/icon-sources/*.svg` via `modules/inline-icons.ts`; an SVG must use `currentColor` to be
inlined. Run `make icons` after changing the toolbar PNG sources.

## Tests

- Pure functions get Vitest unit tests in the neighbouring `__tests__/` directory. `happy-dom` covers
  the DOM components.
- Anything needing a real browser goes in `apps/chrome-extension/e2e/tests/*.mjs`. Gemini Nano is
  stubbed by `e2e/shim/e2e-fake-nano.content.ts`, so the suite is deterministic and offline.
- Anything that cannot be automated is verified by loading `apps/chrome-extension/.output/chrome-mv3/`
  unpacked and exercising it by hand. Say so in the pull request.

## Commits and pull requests

- One change per branch and per pull request. Keep the diff scoped to it.
- Commit messages are **one line only** — no blank line, no body, no bullet list, no co-author or
  generator footer. Conventional prefixes: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `ci`.
- Pull-request titles become the generated release changelog, so write them for a reader who has not
  seen the diff.
- Add a `CHANGELOG.md` entry under `## [Unreleased]` for anything user-visible.

## Releasing

Maintainers only — see [docs/release-checklist.md](docs/release-checklist.md). Releases are
tag-driven: `pnpm -C apps/chrome-extension version <x.y.z>`, push with `--follow-tags`, and the
workflow does the rest. The tag must match `apps/chrome-extension/package.json` or the build fails.

## Privacy is a constraint, not a feature

Promptizer makes no network requests, declares no `host_permissions`, and refuses to read password,
one-time-code and payment fields. Any change that weakens one of those needs to be argued for in an
issue before it is written. `apps/chrome-extension/scripts/assert-manifest.sh` enforces the manifest half of that
contract on every build.
