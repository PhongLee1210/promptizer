# AGENTS.md

## What this repo is

Promptizer rewrites a messy prompt into one clean paragraph, keeping the original task and intent.

- `src/` — WXT-built Chrome MV3 extension that works on any site with a recognized text composer, using on-device
  Gemini Nano.

The rewrite is always shown as an editable preview. Nothing is submitted automatically.

## Working rules

- ALWAYS Serena MCP for code work.
- ALWAYS use pnpm. Never `npm install`, never `npx`, never commit a `package-lock.json`.
- `packageManager` in `package.json` pins the pnpm version; activate it with `corepack install -g pnpm@10`.
- Stay on pnpm 10. Corepack's shim loads `bin/pnpm.cjs`, which pnpm 11 and later no longer ship, so `pnpm -v` fails
  with `MODULE_NOT_FOUND` on those versions.
- Run binaries through `pnpm exec`, not `npx` or `./node_modules/.bin/`.
- `pnpm.onlyBuiltDependencies` in `package.json` lists the packages allowed to run install scripts. pnpm blocks them
  by default; esbuild is listed because vite and vitest need its native binary.
- Pin `vite` to `^7`. wxt 0.21.5 accepts `^6.3.4 || ^7 || ^8.0.0-0` and vitest 3.2.7 accepts `^5 || ^6 || ^7`, so 7 is
  the only major both allow, and two vite copies in the store produce unassignable plugin types in `vitest.config.ts`.
  `.github/dependabot.yml` ignores vite majors to enforce this. Drop that ignore only once vitest is on 4 or later,
  whose range widens to `^6 || ^7 || ^8`.
- Chrome and Edge only. The automated checks run in Chrome. Load the extension unpacked from `.output/chrome-mv3/`.
- One change per branch and pull request. Keep diffs scoped to it.
- Commit messages are ONE line only. No blank line, no body, no bullet list, no trailing co-author or
  generator footer.
- Ask before adding a dependency, renaming or moving files, or changing global configuration.
- Keep the existing structure. Edit the files that are already there instead of adding new ones unless a new file is
  genuinely required.
- There is no limit on file or function length, so prefer extending an existing file over splitting it.
- No third-party runtime JavaScript dependencies beyond the extension framework's own bundled helpers, and no UI
  framework. WXT, Vite, Vitest, happy-dom, Puppeteer, TypeScript and Prettier are the permitted dev dependencies.
- Pure functions get Vitest unit tests under the neighbouring `__tests__/` directory. Anything that needs a real
  browser is verified by loading `.output/chrome-mv3/` unpacked and exercising it by hand.
- Formatting is Prettier's: 2 spaces, semicolons, double quotes, trailing commas, `printWidth` 120. Configured in
  `.prettierrc.json`; `.prettierignore` keeps it out of generated output, vendored agent directories and `docs/`.
- Use `import type` for type-only imports.
- No comments in the code. Names and structure carry the meaning.
- Never log, commit or expose credentials. Never print or commit `.env`. Mask password, payment-card and
  one-time-code values wherever page content is returned.
- Do not edit `.output/**`, `.wxt/**` or `src/utils/icons.ts`. All three are produced by the build.

## Verify

```bash
make verify        # typecheck, vitest, prettier, build
make format        # prettier --write
make format-check  # prettier --check
pnpm run test:e2e  # Puppeteer E2E suite
```
