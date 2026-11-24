# AGENTS.md

## What this repo is

Promptizer rewrites a messy prompt into one clean paragraph, keeping the original task and intent.

- `apps/chrome-extension/` — WXT-built Chrome MV3 extension that works on any site with a recognized text composer,
  using on-device Gemini Nano.
- `packages/` — `ui` (design tokens), `config` (shared tsconfig baseline), `shared` (shared types and constants),
  `i18n` (typed en dictionary). Source-only packages: `exports` point at `.ts` and `.css`, no build step.

The rewrite is always shown as an editable preview. Nothing is submitted automatically.

## Working rules

- ALWAYS Serena MCP for code work.
- ALWAYS use pnpm. Never `npm install`, never `npx`, never commit a `package-lock.json`.
- `packageManager` in `package.json` pins the pnpm version; activate it with `corepack install -g pnpm@10`.
- Stay on pnpm 10. Corepack's shim loads `bin/pnpm.cjs`, which pnpm 11 and later no longer ship, so `pnpm -v` fails
  with `MODULE_NOT_FOUND` on those versions.
- Run binaries through `pnpm exec`, not `npx` or `./node_modules/.bin/`.
- `pnpm.onlyBuiltDependencies` in `package.json` lists the packages allowed to run install scripts. pnpm blocks them
  by default; esbuild is listed because Vite needs its native binary.
- The repo is a pnpm workspace (`pnpm-workspace.yaml`): run everything from the root, per-app commands go through
  `pnpm -C apps/chrome-extension`. Shared dependency versions live in the workspace catalog so exactly one copy of
  each tool exists across apps. Checks fan out through Turborepo; `make verify` stays the human entry point.
- Keep `vite` on `^7` across the workspace to avoid duplicate Vite versions and incompatible plugin types.
  `.github/dependabot.yml` ignores Vite major upgrades.
- Chrome and Edge only. The automated checks run in Chrome. Load the extension unpacked from
  `apps/chrome-extension/.output/chrome-mv3/`.
- One change per branch and pull request. Keep diffs scoped to it.
- Commit messages are ONE line only. No blank line, no body, no bullet list, no trailing co-author or
  generator footer.
- Ask before adding a dependency, renaming or moving files, or changing global configuration.
- Keep the existing structure. Edit the files that are already there instead of adding new ones unless a new file is
  genuinely required.
- There is no limit on file or function length, so prefer extending an existing file over splitting it.
- No third-party runtime JavaScript dependencies beyond the extension framework's own bundled helpers, and no UI
  framework. WXT, Vite, Puppeteer, TypeScript, Prettier and Turborepo are the permitted dev
  dependencies. Workspace packages under `packages/` are first-party code, not dependencies.
- E2E is the primary test strategy. Extend the existing Puppeteer journeys instead of adding unit tests or test
  frameworks unless explicitly requested. Keep tests focused on user-visible behavior and avoid duplicate coverage.
  Real on-device model behavior is verified by loading `apps/chrome-extension/.output/chrome-mv3/` unpacked.
  Prefer a small test suite that is easy to maintain.
- Formatting is Prettier's: 2 spaces, semicolons, double quotes, trailing commas, `printWidth` 120. Configured in
  `.prettierrc.json`; `.prettierignore` keeps it out of generated output, vendored agent directories and `docs/`.
- Use `import type` for type-only imports.
- No comments in the code. Names and structure carry the meaning.
- Never log, commit or expose credentials. Never print or commit `.env`. Mask password, payment-card and
  one-time-code values wherever page content is returned.
- Do not edit `apps/chrome-extension/.output/**`, `apps/chrome-extension/.wxt/**` or
  `apps/chrome-extension/src/utils/icons.ts`. All three are produced by the build.

## Verify

```bash
make verify        # typecheck, prettier, build, E2E
make format        # prettier --write
make format-check  # prettier --check
pnpm run test:e2e  # Puppeteer E2E suite
```
