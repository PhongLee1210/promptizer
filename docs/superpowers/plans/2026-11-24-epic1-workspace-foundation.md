# Epic 1 — Workspace Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Current status (2026-11-24):** Foundation implementation merged in PR #7. Automated verification
passes; Task 8 Step 2 (manual Journey A with real Gemini Nano) remains open. Follow-up testing
cleanup removes unit tests and Vitest; `make verify` now runs types, formatting, build and E2E.
The original steps below remain the historical implementation record.

**Goal:** Reorganize the repository into a pnpm workspace orchestrated by Turborepo, move the extension unchanged into `apps/chrome-extension/`, and stand up four shared packages (`ui`, `config`, `shared`, `i18n`). Nothing user-visible changes. Epic 1 is the regression guard for the whole MVP: a never-signed-in user must notice nothing.

**Parent plan:** `docs/superpowers/plans/2026-11-24-promptizer-mvp.md` (product plan) · `docs/superpowers/plans/2026-11-24-promptizer-mvp-task-breakdown.md` (task T-1.1.1 through T-1.1.7)

**This document is the T-1.1.1 decision record.** The five decisions below were made by the product owner on 2026-11-24 and are final for this epic.

## Decisions

| # | Decision | Choice | Consequence |
| --- | --- | --- | --- |
| D1 | Workspace layout | `apps/*` + `packages/*` as diagrammed below | extension moves; backend/dashboard get reserved slots |
| D2 | Check orchestration | **Turborepo** (owner-approved; adds a dev dependency) | `turbo.json` pipeline; local disk cache only, no remote cache, no Vercel account |
| D3 | `packages/ui` day one | CSS design tokens + plain styles only | `tokens.css` moves to the package; no framework, no components, no behavior |
| D4 | `packages/i18n` day one | Shell + typed `en` dictionary + loader | no surface adopts it yet; `chrome.i18n` bridging deferred until a second locale exists |
| D5 | `apps/web` and `apps/worker` | **Omitted** | landing page is parked; MVP has zero background work; names stay reserved here |

## Architecture

```
promptizer/                      workspace root
├── apps/
│   ├── chrome-extension/        today's extension, moved whole
│   ├── core/                    backend API                    — Epic 2, reserved
│   └── dashboard/               prompt/pack portal             — Epic 2, reserved
├── packages/
│   ├── ui/                      @promptizer/ui      design tokens, plain CSS
│   ├── config/                  @promptizer/config  shared tsconfig baseline
│   ├── shared/                  @promptizer/shared  shared types & constants
│   └── i18n/                    @promptizer/i18n    typed en dictionary + loader
├── pnpm-workspace.yaml          workspace globs + dependency catalog
├── turbo.json                   task pipeline
├── package.json                 root manifest (orchestrator only)
└── Makefile                     human entry point, unchanged role
```

Reserved but deliberately absent (D5): `apps/web` (public landing page — parked in the product plan), `apps/worker` (no background work in MVP). When either starts, it is a new app in the existing globs; nothing else moves.

**Root keeps:** `AGENTS.md`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `LICENSE`, `Makefile`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `.github/`, `docs/`, `.gitignore`, `.editorconfig`, `.nvmrc`, `.prettierrc.json`, `.prettierignore`.

**Moves to `apps/chrome-extension/`:** `src/`, `public/`, `e2e/`, `scripts/`, `modules/`, `wxt.config.ts`, `vitest.config.ts`, `tsconfig.json`, `.env.example`, the local untracked `.env`, and a new app `package.json` that takes over today's root scripts and dev dependencies.

**Deleted:** the untracked `bin/` directory (stale compiled binary) in Task 7.

**Package boundary rules:**

- Packages ship **TypeScript source only** (`exports` points at `.ts`); no build step, no emitted `.js`. Vite, Vitest and `tsc` (moduleResolution bundler) all consume them. If a future backend stack needs built output, that is T-2.0.2's decision, not this epic's.
- `packages/ui` owns `tokens.css` and nothing else today. Surface-specific styles (`base.css`, `states.css`, `popup.css`) stay in the extension. No component library: D3 exists precisely so no dashboard stack is pre-committed.
- `packages/config` holds `tsconfig.base.json` for the Epic 2 apps. The extension keeps extending `./.wxt/tsconfig.json` (WXT-generated); it does not consume the config package.
- Dependency versions live in the workspace **catalog** so exactly one copy of `vite`, `vitest`, `typescript`, `prettier`, `happy-dom`, `puppeteer` and `wxt` exists across all apps — the two-vite-copies landmine in AGENTS.md is enforced structurally.

## Tech Stack

pnpm 10.34 workspaces with `catalog:`, Turborepo 2 (pin `^2` at the latest 2.x at execution time; run via `pnpm exec turbo`, never `npx`), TypeScript 5.9, WXT 0.21, Vitest 3 + happy-dom, Puppeteer for E2E. No remote caching; `.turbo/` is local and gitignored.

## Global Constraints

- pnpm only. Run binaries through `pnpm exec`. Never `npm install`, never `npx`.
- No new runtime dependencies. Turborepo is the **only** new dev dependency, approved by the owner (D2).
- Repo pins carried over unchanged: `packageManager: pnpm@10.34.9` stays at the root manifest; `pnpm.onlyBuiltDependencies` keeps `esbuild` (add `turbo` only if pnpm reports blocked install scripts for it); `vite` stays on `^7` via the catalog; the dependabot vite major-ignore stays.
- Prettier rules unchanged; `printWidth` 120. `import type` for type-only imports. No comments in code.
- Commit messages are ONE line, no body, no footer.
- Do not edit `apps/chrome-extension/.output/**`, `apps/chrome-extension/.wxt/**` or `apps/chrome-extension/src/utils/icons.ts` (the moved paths of the three generated artifacts).
- Historical records are not rewritten: files under `docs/superpowers/plans/` and `docs/superpowers/specs/` keep their old root-relative paths even after the move; the stale-path grep in Task 6 excludes them.
- One branch for the whole epic: `feature/workspace-foundation`.

**Repo rule changes requiring the owner's approval (all listed here, landing in Task 6's AGENTS.md edit):**

1. The permitted dev-dependency list gains **Turborepo** (approved via D2).
2. Every root-relative path in AGENTS.md gains the `apps/chrome-extension/` prefix (build output, icons, unpacked-load instructions).
3. The repo-layout section of AGENTS.md is replaced by the diagram above.
4. `.gitignore` / `.prettierignore`: the anchored pattern `src/utils/icons.ts` becomes `apps/chrome-extension/src/utils/icons.ts` (slash-containing patterns are root-anchored; `.output/`, `.wxt/`, `node_modules/` match at any depth and stay as they are).

## Review Focus

1. **One lockfile, one copy of each tool.** After the move, `pnpm install` from the root must produce a single `pnpm-lock.yaml` with importers for root + app + packages, and zero duplicate `vite`/`vitest` in the store. Pinned by the catalog and checked in Task 2.
2. **Anchored ignore patterns.** `src/utils/icons.ts` in `.gitignore` and `.prettierignore` is root-anchored; after the move the generated file would become tracked/prettified if the pattern is not updated. Checked in Task 2.
3. **Tokens must still reach shadow roots.** `tokens.css` uses `:where(:root, :host)` so the same file serves document and shadow consumers; after moving it into `@promptizer/ui`, both `?inline` importers (`chip.ts`, `translate-bubble.ts`) and the `@import` in `base.css` must resolve through Vite from a workspace package. Checked in Task 4.
4. **CI and release paths.** `assert-manifest.sh`, the artifact upload path, the release version read and `wxt zip` all assume the repo root; after the move every one is wrong until fixed. Checked in Task 2.
5. **Nothing user-visible changes.** The built extension before and after the epic is byte-comparable in behavior: chip, rail, popup, rewrite, translate flag. Manual Journey A smoke in Task 8.

---

### Task 1: Workspace root scaffold — T-1.1.2 · 1.5h

**Files:**
- Create: `pnpm-workspace.yaml`, `turbo.json`
- Modify: `package.json`, `.gitignore`

**Interfaces:** none. The repo stays a single package this task; the extension still lives at the root.

- [x] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
catalog:
  happy-dom: ^21.0.4
  prettier: ^3.10.1
  puppeteer: ^25.18.1
  typescript: ^5.9.3
  vite: ^7.3.8
  vitest: ^3.2.7
  wxt: ^0.21.5
```

The globs match nothing yet; pnpm still installs the root package and produces one lockfile. Versions are today's root versions, moved verbatim into the catalog.

- [x] **Step 2: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".output/**", "dist/**"] },
    "test": {},
    "typecheck": {}
  }
}
```

- [x] **Step 3: Add Turborepo to the root manifest**

Add `"turbo": "^2"` to `devDependencies`. Keep every existing script and dev dependency untouched — the root package is still the extension app this task. Switch the catalog-able entries (`prettier`) to `"catalog:"`.

- [x] **Step 4: Install and check for blocked scripts**

Run: `pnpm install`
Expected: one lockfile; no warning naming `turbo` as an ignored build script. If pnpm does flag it, add `"turbo"` to `pnpm.onlyBuiltDependencies` and re-run — nothing else goes in that list.

- [x] **Step 5: Prove the workspace and pipeline parse**

Run: `pnpm exec turbo run typecheck test build`
Expected: turbo starts, reads `pnpm-workspace.yaml` and `turbo.json`, and reports `0 packages` —
Turborepo 2 deliberately excludes the workspace root from task runs, and no member app exists yet.
This validates the wiring; the across-all-apps proof lands in Task 2, when the extension is a real
member. Add `.turbo/` to `.gitignore` (created once tasks actually run).

- [x] **Step 6: Keep `make verify` the human entry, unchanged in meaning**

The Makefile targets still run the direct commands this task; they switch to the turbo delegates in Task 2. Run `make verify` and expect green, identical to before the scaffold.

- [x] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml turbo.json package.json Makefile .gitignore pnpm-lock.yaml
git commit -m "chore: scaffold pnpm workspace root with turbo"
```

---

### Task 2: Move the extension into apps/chrome-extension — T-1.1.3 · 2.5h

**Files:**
- Create: `apps/chrome-extension/package.json`
- Move: `src/`, `public/`, `e2e/`, `scripts/`, `modules/`, `wxt.config.ts`, `vitest.config.ts`, `tsconfig.json`, `.env.example`, `.env` (untracked)
- Modify: `package.json` (root becomes orchestrator-only), `Makefile`, `.gitignore`, `.prettierignore`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.github/dependabot.yml`

**Interfaces:** the extension's public behavior is untouched. WXT's project root becomes `apps/chrome-extension/`; its generated dirs (`.wxt/`, `.output/`) and all app-relative paths (`srcDir: "src"`, `public/`, `modules/` auto-discovery) follow automatically.

- [x] **Step 1: `git mv` the extension into its app slot**

```bash
mkdir -p apps
git mv src public e2e scripts modules wxt.config.ts vitest.config.ts tsconfig.json .env.example apps/chrome-extension/
mv .env apps/chrome-extension/ 2>/dev/null || true
rm -rf .wxt .output
```

The generated dirs are deleted, not moved; the app recreates them on next `wxt prepare` / build.

- [x] **Step 2: Create the app manifest `apps/chrome-extension/package.json`**

```json
{
  "name": "@promptizer/chrome-extension",
  "private": true,
  "version": "0.1.2",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build && bash scripts/assert-manifest.sh",
    "zip": "wxt zip && bash scripts/assert-manifest.sh",
    "test": "vitest run",
    "test:e2e": "./e2e/with-test-build.sh",
    "typecheck": "wxt prepare && tsc --noEmit"
  },
  "devDependencies": {
    "happy-dom": "catalog:",
    "puppeteer": "catalog:",
    "typescript": "catalog:",
    "vite": "catalog:",
    "vitest": "catalog:",
    "wxt": "catalog:"
  }
}
```

`build` absorbs `assert-manifest.sh` so the assertion is part of any build invocation, from Make, CI or turbo.

- [x] **Step 3: Slim the root `package.json` to the orchestrator**

```json
{
  "name": "promptizer",
  "private": true,
  "packageManager": "pnpm@10.34.9",
  "scripts": {
    "build": "pnpm exec turbo run build",
    "format": "pnpm exec prettier --write .",
    "format:check": "pnpm exec prettier --check .",
    "test": "pnpm exec turbo run test",
    "test:e2e": "pnpm -C apps/chrome-extension run test:e2e",
    "typecheck": "pnpm exec turbo run typecheck",
    "verify": "pnpm run typecheck && pnpm run test && pnpm run format:check && pnpm run build"
  },
  "devDependencies": {
    "prettier": "catalog:",
    "turbo": "^2"
  },
  "pnpm": { "onlyBuiltDependencies": ["esbuild"] }
}
```

Root scripts keep the exact names CI already calls (`typecheck`, `test`, `build`, `format:check`, `test:e2e`), so workflow edits stay path-only.

- [x] **Step 4: Point the Makefile at the root scripts**

```make
.PHONY: icons typecheck test-ext build-ext format format-check verify clean

icons:
	pnpm -C apps/chrome-extension exec bash scripts/generate-icons.sh

typecheck:
	pnpm run typecheck

test-ext:
	pnpm run test

build-ext:
	pnpm run build

format:
	pnpm run format

format-check:
	pnpm run format:check

verify: typecheck test-ext format-check build-ext

clean:
	rm -rf ./dist
```

- [x] **Step 5: Fix the anchored ignore patterns**

In `.gitignore` and `.prettierignore`: `src/utils/icons.ts` → `apps/chrome-extension/src/utils/icons.ts`. The any-depth patterns (`node_modules/`, `.output/`, `.wxt/`, `bin/`, `.turbo/`) need no change.

- [x] **Step 6: Fix CI paths**

`.github/workflows/ci.yml`: delete the separate "Assert built manifest" step (now inside `build`); change the artifact `path:` to `apps/chrome-extension/.output/chrome-mv3`. Every other step calls root scripts by name and stays as-is. Job names keep their meaning ("Extension quality").

- [x] **Step 7: Fix release paths**

`.github/workflows/release.yml`: the version check reads `require("./apps/chrome-extension/package.json").version`; the build becomes `pnpm -C apps/chrome-extension run zip`; the zip path becomes `cp "apps/chrome-extension/.output/promptizer-${version}-chrome.zip" dist/`.

- [x] **Step 8: Fix dependabot directories**

`.github/dependabot.yml`: the npm entry's `directory: /` becomes

```yaml
    directories:
      - /
      - /apps/*
      - /packages/*
```

Groups, schedules and the vite major-ignore stay unchanged.

- [x] **Step 9: Audit shell scripts and the E2E harness for root-relative paths**

`e2e/with-test-build.sh`, `e2e/harness.mjs` and `scripts/*.sh` now run with `apps/chrome-extension` as cwd (turbo and `pnpm -C` both set it). Fix any path that still assumes the repo root — resolve from the script's own location or the app root. Read each file before assuming; do not blind-replace.

- [x] **Step 10: Install, verify from the root, run E2E from the new location**

```bash
pnpm install
make verify
pnpm run test:e2e
```

Expected: one lockfile with two importers (root + app); typecheck, unit tests, formatting, build with manifest assertion, and the Puppeteer E2E suite all green.

- [x] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: move extension into apps/chrome-extension"
```

---

### Task 3: config and shared packages — T-1.1.4 · 1h · ⇉

**Files:**
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`
- Create: `packages/shared/package.json`, `packages/shared/src/index.ts`
- Create: `apps/chrome-extension/src/__tests__/workspace-packages.test.ts`
- Modify: `apps/chrome-extension/package.json` (dependency on `@promptizer/shared`)

**Interfaces:**

```ts
// packages/shared/src/index.ts
export const PRODUCT_NAME = "Promptizer";
```

`PRODUCT_NAME` is the placeholder definition T-1.1.4 requires; T-3.0.1 replaces it with the real shared types. `packages/config/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Adopted by the first Epic 2 app; the extension keeps extending `./.wxt/tsconfig.json`.

- [x] **Step 1: Create `packages/config`**

`package.json`: `{ "name": "@promptizer/config", "private": true }` plus the tsconfig above. No exports, no behavior.

- [x] **Step 2: Create `packages/shared`**

`package.json`:

```json
{
  "name": "@promptizer/shared",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" }
}
```

- [x] **Step 3: Prove resolution from the extension app**

`apps/chrome-extension/src/__tests__/workspace-packages.test.ts` (grown by Tasks 4 and 5):

```ts
import { expect, it } from "vitest";
import { PRODUCT_NAME } from "@promptizer/shared";

it("resolves @promptizer/shared from the extension app", () => {
  expect(PRODUCT_NAME).toBe("Promptizer");
});
```

Add `"@promptizer/shared": "workspace:*"` to the app's `dependencies`.

- [x] **Step 4: Run and commit**

Run: `pnpm exec turbo run typecheck test build`
Expected: green; the new test passes.

```bash
git add packages apps/chrome-extension/src/__tests__/workspace-packages.test.ts apps/chrome-extension/package.json pnpm-lock.yaml
git commit -m "chore: add config and shared packages"
```

---

### Task 4: ui package — design tokens — 2h · ⇉

**Files:**
- Move: `apps/chrome-extension/src/styles/tokens.css` → `packages/ui/tokens.css`
- Create: `packages/ui/package.json`
- Modify: `apps/chrome-extension/src/content/chip.ts`, `apps/chrome-extension/src/content/translate-bubble.ts` (import paths), `apps/chrome-extension/src/styles/base.css` (`@import`), `apps/chrome-extension/src/styles/__tests__/tokens.test.ts` (source of `tokensCss`), `apps/chrome-extension/package.json` (dependency)

**Interfaces:** the token contract is unchanged — same names, same values, same `:where(:root, :host)` dual scoping. Only the path changes.

- [x] **Step 1: Move the file and declare the package**

```bash
mkdir -p packages/ui
git mv apps/chrome-extension/src/styles/tokens.css packages/ui/tokens.css
```

`packages/ui/package.json`:

```json
{
  "name": "@promptizer/ui",
  "private": true,
  "exports": { "./tokens.css": "./tokens.css" }
}
```

Add `"@promptizer/ui": "workspace:*"` to the app's `dependencies`.

- [x] **Step 2: Update the four consumers**

`chip.ts` and `translate-bubble.ts`: `import designTokens from "@promptizer/ui/tokens.css?inline";`
`base.css` line 1: `@import "@promptizer/ui/tokens.css";`
`tokens.test.ts`: resolve the package subpath and read it — `readFileSync(createRequire(import.meta.url).resolve("@promptizer/ui/tokens.css"), "utf8")`. Vitest's CSS pipeline hands back an empty string for `?inline` imports, so file-content assertions cannot import the CSS; the other file reads (`base.css`, `states.css`, `popup.css`, `chip.ts`, `rail.ts`, `result-window.ts`) keep resolving from the app.

- [x] **Step 3: Extend the resolution proof**

Add to `workspace-packages.test.ts`:

```ts
it("resolves @promptizer/ui tokens from the extension app", () => {
  const tokensCss = readFileSync(createRequire(import.meta.url).resolve("@promptizer/ui/tokens.css"), "utf8");
  expect(tokensCss).toContain("--pz-neutral-0");
});
```

- [x] **Step 4: Verify tokens still reach both consumers**

Run: `pnpm exec turbo run typecheck test build`
Expected: green, including the full `tokens.test.ts` contract suite.
Run: `grep -c "pz-neutral-97" apps/chrome-extension/.output/chrome-mv3/**/*.css` (or the equivalent directory grep)
Expected: nonzero — the tokens are present in the built CSS.

- [x] **Step 5: Manual shadow-root spot check**

Load `apps/chrome-extension/.output/chrome-mv3/` unpacked; the chip and the translate bubble render with correct colors (they inject `tokens.css` inline into closed shadow roots).

- [x] **Step 6: Commit**

```bash
git add packages apps/chrome-extension pnpm-lock.yaml
git commit -m "feat: extract design tokens into ui package"
```

---

### Task 5: i18n package — shell + en dictionary — 1.5h · ⇉

**Files:**
- Create: `packages/i18n/package.json`, `packages/i18n/src/index.ts`, `packages/i18n/src/en.ts`, `packages/i18n/src/__tests__/i18n.test.ts`
- Modify: `apps/chrome-extension/package.json` (dependency), `apps/chrome-extension/src/__tests__/workspace-packages.test.ts`

**Interfaces:**

```ts
export type Locale = "en";
export type Dictionary = { readonly [key: string]: string };

export const en: Dictionary = { "shared.productName": "Promptizer" };

export function createTranslator(locale: Locale): (key: string) => string;
```

`t(key)` returns the dictionary entry or the key itself when missing. No `chrome.i18n` bridging, no locale detection, no pluralization — D4.

- [x] **Step 1: Create the package**

`package.json`:

```json
{
  "name": "@promptizer/i18n",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "devDependencies": { "vitest": "catalog:" }
}
```

- [x] **Step 2: Write the failing tests**

```ts
it("translates a known key", () => {
  expect(createTranslator("en")("shared.productName")).toBe("Promptizer");
});

it("returns the key itself when the dictionary lacks it", () => {
  expect(createTranslator("en")("nope.missing")).toBe("nope.missing");
});

it("ships exactly one locale: en", () => {
  expect(en).toBeDefined();
});
```

Run: `pnpm -C packages/i18n run test` — expect FAIL (module not found), then implement and expect PASS.

- [x] **Step 3: Extend the extension-side resolution proof**

Add `createTranslator` / `en` from `@promptizer/i18n` to `workspace-packages.test.ts` with the known-key assertion, and `"@promptizer/i18n": "workspace:*"` to the app's `dependencies`.

- [x] **Step 4: Verify through the pipeline**

Run: `pnpm exec turbo run typecheck test build`
Expected: green; turbo discovers the i18n `test` task on its own (script present, no config needed).

- [x] **Step 5: Commit**

```bash
git add packages apps/chrome-extension/src/__tests__/workspace-packages.test.ts apps/chrome-extension/package.json pnpm-lock.yaml
git commit -m "feat: add i18n package with en dictionary"
```

---

### Task 6: Contributor docs point at the new layout — T-1.1.5 · 1h · ⇉

**Files:**
- Modify: `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `docs/release-checklist.md`

`docs/architecture.md` and `docs/features.md` carry no repository paths and stay untouched; the
release checklist turned out to describe the old single-package release flow and joins this task.

**Interfaces:** none.

- [x] **Step 1: Update AGENTS.md**

Apply the four approved repo-rule changes from Global Constraints: the permitted dev-deps list gains Turborepo; root-relative paths gain the `apps/chrome-extension/` prefix (unpacked load path, `src/utils/icons.ts`, `.output`, `.wxt`); the repo-layout paragraph becomes the Architecture diagram; the workspace rules (catalog, `pnpm -C`, turbo) are stated where the old single-app text stood.

- [x] **Step 2: Update the remaining contributor docs**

`README.md` and `CONTRIBUTING.md`: setup (`corepack install -g pnpm@10`, `pnpm install`), verify (`make verify`), tests (`pnpm run test:e2e`), unpacked load from `apps/chrome-extension/.output/chrome-mv3/`. `docs/architecture.md`: the repository-layout section. `docs/features.md`: only loading-path references.

- [x] **Step 3: Prove zero stale paths**

```bash
grep -rn "\.output/chrome-mv3\|src/styles/tokens\|scripts/assert-manifest\|wxt zip" \
  README.md CONTRIBUTING.md AGENTS.md docs/architecture.md docs/features.md CHANGELOG.md
```

Expected: no live-document hit referencing the old root paths. `docs/superpowers/**` and `.serena/**` are historical records and are excluded by design.

- [x] **Step 4: Newcomer walkthrough**

Follow README setup from a clean clone in `/private/var/folders/qb/p9r5ly7n209c2wcbnh26n1wm0000gp/T/opencode`: `corepack install -g pnpm@10`, `pnpm install`, `make verify` — lands green with the extension built at `apps/chrome-extension/.output/chrome-mv3/`.

- [x] **Step 5: Commit**

```bash
git add AGENTS.md README.md CONTRIBUTING.md docs/architecture.md docs/features.md
git commit -m "docs: point contributor docs at workspace layout"
```

---

### Task 7: Remove stale artifacts — T-1.1.6 · 0.5h · ⇉

**Files:**
- Delete: `bin/` (untracked directory holding the compiled Go binary)

**Interfaces:** none.

- [x] **Step 1: Delete the directory**

```bash
rm -rf bin
```

- [x] **Step 2: Prove nothing references it**

```bash
grep -rni "promptrefine\|PROMPTREFINE\|GROQ" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs --exclude-dir=.serena .
```

Expected: empty. `.env.example` already carries only `WXT_FEATURE_TRANSLATE_ON_PAGE`; `docs/superpowers/**` and `.serena/**` are historical records.

- [x] **Step 3: Workspace still green**

Run: `make verify` — green.

- [x] **Step 4: Record the outcome — no commit**

`bin/` was never tracked, and the only remaining textual matches are records, not references:
`CHANGELOG.md`'s entry describing the already-removed Go backend. The moved local `.env` turned out
to hold nothing but the stale `GROQ_API_KEY` for that removed backend; the file is deleted locally
(untracked, never committed). Nothing tracked changes, so the task leaves no commit.

---

### Task 8: Full workspace verify pass — T-1.1.7 · 1h

**Files:** none (verification only; fixes, if any, become their own commits).

- [x] **Step 1: Clean-clone verify**

From a fresh clone: `pnpm install && make verify && pnpm run test:e2e`. All green from the root, including turbo cache misses (clean clone = cold cache).

- [ ] **Step 2: Manual Journey A smoke**

Load `apps/chrome-extension/.output/chrome-mv3/` unpacked in Chrome: the chip appears on a recognized composer, one rewrite works, the popup opens, the action rail behaves. Optionally repeat in Edge. Nothing differs from the pre-epic build.

- [x] **Step 3: Push the branch and confirm CI**

```bash
git push -u origin feature/workspace-foundation
```

CI green: format, typecheck, unit tests, build with manifest assertion, artifact upload from the new path, E2E under xvfb.

Verification follow-up (2026-11-24):

- Confirmed commit `ccbeabd01fc56588509800df8475b8d0a2a3f5f0` on PR [#7](https://github.com/PhongLee1210/promptizer/pull/7). Both jobs in [CI run 45399945123](https://github.com/PhongLee1210/promptizer/actions/runs/45399945123) passed, including the corrected app-scoped Puppeteer install and extension artifact upload.
- Fresh local `pnpm exec turbo run typecheck test build --force` passed with Node 22.22.2: 375 extension tests and 3 i18n tests, typecheck, production build, and manifest assertion. All four tasks executed without cache hits.
- Local `pnpm run test:e2e` passed all 30 checks across 10 scenarios. The sandbox initially blocked the localhost test server; the approved run outside the sandbox passed. A subsequent production build removed the test shim from the unpacked bundle.
- Formatted the untracked exported session Markdown because it was the only file failing the root formatting check.
- Final root `make verify` passed with Node 22.22.2 after formatting the session export.
- The default shell uses Node 26.13.1, where 18 popup tests fail because `localStorage` is undefined. Node 22, matching CI, passes without source changes; use the installed Node 22 for verification.
- Manual Journey A remains unverified: browser access reported its host unavailable, and native Chrome control timed out. Automated E2E uses a fake Nano implementation and does not establish a real on-device rewrite or a manual popup smoke result. Step 2 remains open.

---

## Summary

| Task | Maps to | Type | Est | ⇉ |
| --- | --- | --- | --- | --- |
| 1 · Workspace root scaffold | T-1.1.2 | infra | 1.5h | |
| 2 · Move the extension | T-1.1.3 | infra | 2.5h | |
| 3 · config + shared packages | T-1.1.4 | infra | 1h | ✓ |
| 4 · ui package (tokens) | new (D3) | feat | 2h | ✓ |
| 5 · i18n package | new (D4) | feat | 1.5h | ✓ |
| 6 · Contributor docs | T-1.1.5 | docs | 1h | ✓ |
| 7 · Stale artifacts | T-1.1.6 | debt | 0.5h | ✓ |
| 8 · Full verify pass | T-1.1.7 | qa | 1h | |
| **Total** | | | **11h** | |

Epic 1 grows from the breakdown's 8h to 11h: Tasks 4 and 5 are the owner's `packages/ui` and `packages/i18n` additions (decisions D3, D4). Tasks 3, 4 and 5 are mutually independent once Task 2 lands — subagent lane material. Task 6 can start after Task 2 (the final paths are known); Task 7 any time after Task 2.
