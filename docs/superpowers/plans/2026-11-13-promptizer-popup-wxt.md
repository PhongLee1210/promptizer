# Promptizer Popup + WXT Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Promptizer extension to WXT + Vite and implement the 4-screen popup and in-page chip specified in `docs/design/promptizer-package/PLAN.md`.

**Architecture:** One WXT project with four entrypoints (popup, content, background, plus generated manifest). The popup is a single document with push/pop navigation between four screens, composed from 18 primitives. All persistence and all provider calls go through two interfaces (`SettingsPort`, `ProviderPort`) so no screen touches `browser.storage` or the network directly, and keys stay behind the Go backend. Model ordering is a pure, exhaustively tested module with a non-empty-tuple chain type that makes "always exactly one primary" unrepresentable-if-violated.

**Tech Stack:** WXT 0.21.x, Vite, TypeScript (vanilla — no UI framework), Vitest + `WxtVitest` + `@webext-core/fake-browser`, ESLint. Go backend unchanged.

**Spec:** `docs/superpowers/specs/2026-11-13-promptizer-popup-design.md` (design record and decisions D1-D8), which implements `docs/design/promptizer-package/PLAN.md` (wireframes, states, asset manifest).

## Global Constraints

- No comments in any source file. `AGENTS.md`.
- No third-party **runtime** JS dependencies beyond WXT's bundled helpers. No UI framework. No icon library.
- Popup width fixed `360px`, must work down to `320px`. Height min `480px`, max `580px`.
- Every control has a minimum hit area of `44x44`, even when the visible part is smaller.
- Text contrast at least `4.5:1`; control borders at least `3:1`.
- Minimum font size `11px`. Sizes in `rem` off a `16px` root.
- Every control is a native `button`, `a` or `input`. Toggles are `button[role=switch][aria-checked]`.
- Focus ring: `2px` accent, `2px` offset, on every focusable element.
- All motion disabled under `prefers-reduced-motion: reduce`; SVG animations rest on their final frame.
- `manifest_version: 3`, `minimum_chrome_version: 138`, `host_permissions` loopback-only (`http://127.0.0.1:8765/*`), no `offscreen` permission.
- API keys: never in `storage.sync`, never logged, never reachable from a content script.
- Dark theme only. Tokens from design record D2 (`bg #14161A`, `surface #1B1E24`, `surface-inset #101216`, `divider #23262D`, `border-control #6E7582`, `track-off #3A3F48`, `text #E8EAED`, `text-2 #B4BAC4`, `text-3 #9AA0AA`, `accent #4C8DFF`, `on-accent #0B1220`, `accent-tint #1B2233`, `success #3FCF8E`, `success-text #7FE0B3`, `success-bg #16291F`, `warning #F5C469`, `warning-bg #2A2415`, `danger #FF8A80`, `danger-bg #2E1A1A`).
- Status is never colour alone. Each status carries a shape and a word: filled dot = ready/in use, hollow dot = standing by, triangle = attention, circle-! = error.
- `make verify` green at the end of every task.

## Review Focus

Input classes the spec implies but assigns to no screen. Each has its test pinned to the task that owns the code.

1. **A chain of length 1 whose only entry is unavailable** — Nano unsupported and no fallbacks. `nextRunnable` must return `null` rather than index 0, and S1 must render state 1f, not a silent failure. Task 7.
2. **Reordering while a refinement is in flight** — the chain changes under a running request. The in-flight attempt must finish against the chain it started with, not the edited one. Task 8.
3. **A platform toggled off while that tab is open** — the content script must tear the chip down without a reload, and must not leave a dangling keydown listener. Task 16.
4. **Key removed while a model using it sits mid-chain** — the entry keeps its position, flips to `key-needed`, and is skipped; it must not be silently deleted from the chain. Task 7.
5. **Provider returns a 200 with an unparseable body** — `saveAndTest` must surface state 4g ("the key works but the request was refused") rather than throwing past the UI and leaving the button spinning forever. Task 15.

---

## File Structure

```
wxt.config.ts                     generated manifest, Vite config, icon module
vitest.config.ts                  WxtVitest plugin
modules/inline-icons.ts           build-time SVG -> typed icon map
src/
  entrypoints/
    background.ts                 service worker; owns provider calls and tab messaging
    content.ts                    defineContentScript; mounts the chip
    popup/index.html              popup document
    popup/main.ts                 router + screen mount
  screens/
    main.ts                       S1
    platforms.ts                  S2
    models.ts                     S3
    providers.ts                  S4
  components/
    primitives.ts                 C5 Toggle, C6 NavRow, C7 SettingRow, C14 Button, C15 StatusDot
    header.ts                     C1, C2, C3 StatusPill
    power-button.ts               C4
    model-card.ts                 C8
    model-slot.ts                 C9, C10 ModelPicker
    provider-row.ts               C11, C12 KeyField
    feedback.ts                   C13 Banner, C16 EmptyState, C17 FooterNote
    chip.ts                       C18 in-page chip
  utils/
    model-chain.ts                chain type and pure reordering/selection logic
    ports.ts                      SettingsPort, ProviderPort interfaces and types
    settings-store.ts             SettingsPort over browser.storage.local
    provider-client.ts            ProviderPort over the paired local Go service
    status.ts                     pill/dot/word derivation from app state
    icons.ts                      generated; do not hand-edit
    core.ts                       ported from extension/core.js
    nano.ts                       ported from extension/nano.js
    adapters/chatgpt.ts, claude.ts, registry.ts
  styles/
    tokens.css                    D2 tokens as custom properties
    base.css                      reset, type scale, focus ring, reduced motion
  assets/fonts/inter-latin.woff2
public/icon/{16,32,48,128}.png    exported from assets/toolbar/toolbar-on.svg
```

Deleted at Task 18: `extension/` in full.

---

## Phase 0 — Unblock

### Task 1: Amend the dependency rule

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace the dependency bullet**

Change "No third-party Go or runtime JavaScript dependencies. ESLint is the only dev dependency." to state: no third-party Go dependencies; no third-party runtime JavaScript dependencies beyond the extension framework's own bundled helpers; no UI framework; WXT, Vite, Vitest and ESLint are the permitted dev dependencies.

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md && git commit -m "docs: permit extension framework dev dependencies"
```

---

## Phase 1 — Foundation

Tasks 2-5 are sequential. Tasks 6, 7, 9 may then run in parallel.

### Task 2: WXT scaffold with the generated manifest

**Files:**
- Create: `wxt.config.ts`, `src/entrypoints/popup/index.html`, `src/entrypoints/popup/main.ts`, `tsconfig.json`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: a `wxt build` that emits `.output/chrome-mv3/manifest.json` satisfying the Global Constraints manifest line.

- [ ] **Step 1: Install and configure**

Add `wxt` and `typescript` to `devDependencies`. `wxt.config.ts` sets `srcDir: "src"` and a `manifest` block carrying `name: "Promptizer"`, `minimum_chrome_version: "138"`, `permissions: ["storage", "activeTab"]`, `host_permissions: ["http://127.0.0.1:8765/*"]`, and the `refine-prompt` command with `Ctrl+Shift+Y` / `Command+Shift+Y`. Add `.output/` and `.wxt/` to `.gitignore`.

- [ ] **Step 2: Add the manifest assertion**

Write `scripts/assert-manifest.sh` running the existing `jq -e` predicate from `Makefile:test-js` against `.output/chrome-mv3/manifest.json`.

- [ ] **Step 3: Build and assert**

Run: `npx wxt build && bash scripts/assert-manifest.sh`
Expected: build succeeds, `jq` exits 0.

- [ ] **Step 4: Commit**

### Task 3: Vitest harness

**Files:**
- Create: `vitest.config.ts`, `src/utils/__tests__/harness.test.ts`
- Modify: `package.json`, `Makefile:test-js`

**Interfaces:**
- Produces: `npx vitest run` as the extension test command; `fakeBrowser` available in every test.

- [ ] **Step 1: Write the failing test**

```ts
import { fakeBrowser } from "wxt/testing/fake-browser";
it("provides an in-memory storage", async () => {
  await fakeBrowser.storage.local.set({ probe: 1 });
  expect((await fakeBrowser.storage.local.get("probe")).probe).toBe(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/__tests__/harness.test.ts`
Expected: FAIL — cannot resolve `vitest.config.ts` plugin or `wxt/testing`.

- [ ] **Step 3: Add `vitest`, `@vitest/coverage-v8` and `happy-dom` as devDependencies; create `vitest.config.ts` with `WxtVitest()` and `environment: "happy-dom"`**

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/utils/__tests__/harness.test.ts`
Expected: PASS.

- [ ] **Step 5: Point `Makefile:test-js` at `npx vitest run` plus `scripts/assert-manifest.sh`, dropping the `node --check` lines; run `make verify`**

Expected: PASS.

- [ ] **Step 6: Commit**

### Task 4: Design tokens and base stylesheet

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/__tests__/tokens.test.ts`
- Create: `src/assets/fonts/inter-latin.woff2`

**Interfaces:**
- Produces: custom properties named `--pz-<token>` for all 19 tokens in the Global Constraints list.

- [ ] **Step 1: Write the failing test**

Parse `tokens.css` as text and assert every token name and exact hex from the Global Constraints list is present, and that the file declares no `@media (prefers-color-scheme: light)` block.

```ts
it("declares every spec token with its exact value", () => {
  expect(css).toContain("--pz-accent: #4C8DFF");
  expect(css).toContain("--pz-bg: #14161A");
  expect(css).not.toContain("prefers-color-scheme: light");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/styles/__tests__/tokens.test.ts`
Expected: FAIL — file not found.

- [ ] **Step 3: Write `tokens.css` and `base.css`**

`base.css` carries the `16px` root, the seven type styles from spec §2.2 (`title` 16/22/600, `header` 15/20/600, `body-strong` 14/20/600, `body` 13/18/400-500, `caption` 12/16/400, `overline` 11/14/600 +0.06em uppercase, `micro` 11/15/400), the `@font-face` for the bundled Inter woff2 with `system-ui, sans-serif` fallback, the `2px`/`2px` accent focus ring on `:focus-visible`, `font-variant-numeric: tabular-nums` on `.pz-num`, and a `prefers-reduced-motion: reduce` block zeroing every duration.

- [ ] **Step 4: Run it to verify it passes**

- [ ] **Step 5: Commit**

### Task 5: Build-time icon inlining

**Files:**
- Create: `modules/inline-icons.ts`, `src/utils/__tests__/icons.test.ts`
- Generated: `src/utils/icons.ts`

**Interfaces:**
- Produces: `export const icons: Record<IconName, string>` where each value is the SVG markup with `width`/`height` stripped and `aria-hidden="true"` added, and `IconName` is a union of the 24 basenames in `docs/design/promptizer-package/assets/icons/`.
- Produces: `export function icon(name: IconName, size?: number): string`.

- [ ] **Step 1: Write the failing test**

```ts
it("inlines every shipped icon with currentColor preserved", () => {
  expect(Object.keys(icons)).toHaveLength(24);
  expect(icons.power).toContain('stroke="currentColor"');
  expect(icons.power).not.toMatch(/\swidth="24"/);
  expect(icon("power", 30)).toContain('width="30"');
});
it("exposes every name the asset manifest lists", () => {
  expect(icons).toHaveProperty("drag-handle");
  expect(icons).toHaveProperty("eye-off");
});
```

- [ ] **Step 2: Run it to verify it fails**

Expected: FAIL — `src/utils/icons.ts` not generated.

- [ ] **Step 3: Write the WXT module**

It reads `docs/design/promptizer-package/assets/icons/*.svg` at build and prepare time and writes `src/utils/icons.ts`. Add the generated file to `.gitignore` and run the module from `wxt prepare` so tests see it.

- [ ] **Step 4: Run it to verify it passes**

- [ ] **Step 5: Export the four toolbar PNGs**

Rasterise `assets/toolbar/toolbar-on.svg` to `public/icon/{16,32,48,128}.png` and reference them from `wxt.config.ts`.

- [ ] **Step 6: Commit**

---

## Phase 2 — Logic (parallel: Tasks 6, 7, 9)

### Task 6: Ports and the settings store

**Files:**
- Create: `src/utils/ports.ts`, `src/utils/settings-store.ts`, `src/utils/__tests__/settings-store.test.ts`

**Interfaces:**
- Produces:

```ts
export type ProviderId = "nano" | "anthropic" | "openai" | "openrouter" | `custom:${string}`;
export interface ModelRef { providerId: ProviderId; modelId: string; label: string }
export interface PlatformSetting { id: string; label: string; origin: string; enabled: boolean; builtIn: boolean }
export interface Settings { enabled: boolean; refineOnEnter: boolean; chain: Chain; platforms: PlatformSetting[]; stepTimeoutMs: 3000 | 5000 | 10000 | 20000 }
export interface SettingsPort {
  read(): Promise<Settings>;
  write(patch: Partial<Settings>): Promise<void>;
  watch(listener: (settings: Settings) => void): () => void;
}
export const defaultSettings: Settings;
```

- Consumes: `Chain` from Task 7. Implement against the type; the two tasks merge cleanly because neither imports the other's implementation.

- [ ] **Step 1: Write the failing tests**

```ts
it("defaults to Nano as the only chain entry", async () => {
  expect((await store.read()).chain).toHaveLength(1);
  expect((await store.read()).chain[0].ref.providerId).toBe("nano");
});
it("defaults the six built-in platforms with DeepSeek off", async () => {
  const platforms = (await store.read()).platforms;
  expect(platforms).toHaveLength(6);
  expect(platforms.find(p => p.id === "deepseek")!.enabled).toBe(false);
});
it("defaults refineOnEnter to false", async () => { ... });
it("defaults stepTimeoutMs to 5000", async () => { ... });
it("writes a patch without clobbering untouched keys", async () => { ... });
it("notifies watchers on an external storage change", async () => { ... });
it("never writes to storage.sync", async () => {
  await store.write({ enabled: false });
  expect(await fakeBrowser.storage.sync.get(null)).toEqual({});
});
```

Platform defaults: `claude`/claude.ai, `chatgpt`/chatgpt.com, `gemini`/gemini.google.com, `perplexity`/perplexity.ai, `copilot`/copilot.microsoft.com all enabled; `deepseek`/chat.deepseek.com off (spec S2 wireframe shows 5 of 6 on).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/utils/__tests__/settings-store.test.ts`

- [ ] **Step 3: Implement `createSettingsStore(): SettingsPort` in `src/utils/settings-store.ts`**

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

### Task 7: Model chain engine

**Files:**
- Create: `src/utils/model-chain.ts`, `src/utils/__tests__/model-chain.test.ts`

**Interfaces:**
- Produces:

```ts
export type ModelStatus = "ready" | "in-use" | "standing-by" | "downloading" | "key-needed" | "unavailable" | "error";
export interface ChainEntry { ref: ModelRef; status: ModelStatus; detail: string; downloadPercent?: number }
export type Chain = readonly [ChainEntry, ...ChainEntry[]];
export function roleLabel(index: number): string;
export function makePrimary(chain: Chain, index: number): Chain;
export function moveEntry(chain: Chain, from: number, to: number): Chain;
export function addFallback(chain: Chain, entry: ChainEntry): Chain;
export function removeEntry(chain: Chain, index: number): Chain;
export function nextRunnable(chain: Chain, from: number): number | null;
export function isRunnable(status: ModelStatus): boolean;
export function applyStatus(chain: Chain, index: number, status: ModelStatus, detail?: string): Chain;
```

- [ ] **Step 1: Write the failing tests**

```ts
it("labels by position, not by model", () => {
  expect(roleLabel(0)).toBe("Always tried first");
  expect(roleLabel(1)).toBe("1st fallback");
  expect(roleLabel(2)).toBe("2nd fallback");
  expect(roleLabel(3)).toBe("3rd fallback");
  expect(roleLabel(11)).toBe("11th fallback");
});
it("refuses to remove the primary", () => {
  expect(() => removeEntry(chainOfThree, 0)).toThrow();
});
it("refuses to remove the last remaining entry", () => {
  expect(() => removeEntry(chainOfOne, 0)).toThrow();
});
it("swaps the primary when a fallback is promoted", () => {
  const next = makePrimary(chainOfThree, 2);
  expect(next[0].ref.modelId).toBe(chainOfThree[2].ref.modelId);
  expect(next[2].ref.modelId).toBe(chainOfThree[0].ref.modelId);
  expect(next).toHaveLength(3);
});
it("moves an entry and preserves every other entry's order", () => { ... });
it("skips unavailable and key-needed entries", () => {
  expect(nextRunnable(mixedChain, 0)).toBe(2);
});
it("returns null when nothing in the chain can run", () => {
  expect(nextRunnable(allUnavailable, 0)).toBeNull();
});
it("returns null for a single unavailable entry rather than index 0", () => {
  expect(nextRunnable(soloUnavailable, 0)).toBeNull();
});
it("keeps a key-needed entry in place instead of dropping it", () => {
  const next = applyStatus(chainOfThree, 1, "key-needed");
  expect(next).toHaveLength(3);
  expect(next[1].status).toBe("key-needed");
});
it("treats downloading as not runnable but not permanent", () => { ... });
it("returns a new array and never mutates its input", () => { ... });
```

The 4th and 8th assertions above are Review Focus items 1 and 4.

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement the module, pure and free of `browser` access**

`roleLabel` uses English ordinals with the 11th-13th exception. `removeEntry` throws `RangeError` for index 0 — the UI never offers it, per D3, so reaching it is a programming error.

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

### Task 8: Chain snapshot isolation

**Files:**
- Modify: `src/utils/model-chain.ts`
- Test: `src/utils/__tests__/model-chain.test.ts`

**Interfaces:**
- Produces: `export function snapshot(chain: Chain): Chain` and `export interface Attempt { chain: Chain; index: number }`, plus `export function advance(attempt: Attempt): Attempt | null`.

- [ ] **Step 1: Write the failing test** (Review Focus item 2)

```ts
it("runs an in-flight attempt against the chain it started with", () => {
  const attempt = { chain: snapshot(chainOfThree), index: 0 };
  const edited = moveEntry(chainOfThree, 2, 0);
  expect(advance(attempt)!.chain[0].ref.modelId).toBe(chainOfThree[0].ref.modelId);
  expect(edited[0].ref.modelId).not.toBe(attempt.chain[0].ref.modelId);
});
```

- [ ] **Step 2: Run it to verify it fails**

- [ ] **Step 3: Implement `snapshot` and `advance`**

- [ ] **Step 4: Run it to verify it passes**

- [ ] **Step 5: Commit**

### Task 9: Status derivation

**Files:**
- Create: `src/utils/status.ts`, `src/utils/__tests__/status.test.ts`

**Interfaces:**
- Produces:

```ts
export type AppState = "active" | "paused" | "site-off" | "unsupported-site" | "using-backup" | "needs-attention" | "all-failing";
export interface Pill { words: string; glyph: "filled" | "hollow" | "triangle" | "error" }
export function appState(input: { enabled: boolean; siteEnabled: boolean; siteKnown: boolean; chain: Chain; allFailed: boolean }): AppState;
export function pillFor(state: AppState): Pill;
export function toolbarIcon(state: AppState): "toolbar-on" | "toolbar-off" | "toolbar-backup" | "toolbar-error";
```

- [ ] **Step 1: Write the failing tests**

One per S1 state 1a-1g, asserting the exact pill words from the spec: `"Active"`, `"Paused"`, `"Using backup"`, `"Not on this site"`, `"Needs attention"`. Plus:

```ts
it("never signals status by colour alone", () => {
  for (const s of allStates) expect(pillFor(s).glyph).toBeTruthy();
});
it("maps all-failing to the error toolbar icon", () => {
  expect(toolbarIcon("all-failing")).toBe("toolbar-error");
});
it("prefers unsupported-site over paused when the tab is unknown", () => { ... });
```

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement the module**

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

---

## Phase 3 — Primitives

### Task 10: C5, C6, C7, C14, C15

**Files:**
- Create: `src/components/primitives.ts`, `src/components/__tests__/primitives.test.ts`

**Interfaces:**
- Produces:

```ts
export function Toggle(opts: { label: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }): HTMLButtonElement;
export function NavRow(opts: { label: string; value?: string; onActivate: () => void }): HTMLButtonElement;
export function SettingRow(opts: { label: string; subLabel?: string; control: HTMLElement; disabled?: boolean; disabledReason?: string }): HTMLElement;
export function Button(opts: { label: string; variant: "primary" | "outline" | "text" | "dashed-add"; icon?: IconName; loading?: boolean; disabled?: boolean; onClick: () => void }): HTMLButtonElement;
export function StatusDot(kind: "filled-success" | "hollow-neutral" | "hollow-warning"): HTMLElement;
```

The spec says build these first; every screen is composed from them.

- [ ] **Step 1: Write the failing tests**

```ts
it("renders a toggle as a native switch button", () => {
  const t = Toggle({ label: "Refine on claude.ai", checked: true, onChange: () => {} });
  expect(t.tagName).toBe("BUTTON");
  expect(t.getAttribute("role")).toBe("switch");
  expect(t.getAttribute("aria-checked")).toBe("true");
});
it("gives every control a 44px minimum hit area", () => {
  for (const el of [toggle, navRow, button]) expect(el.style.minHeight).toBe("44px");
});
it("states why a disabled control is disabled in adjacent text, not a tooltip", () => {
  const row = SettingRow({ label: "x", control: toggle, disabled: true, disabledReason: "Refinement is paused" });
  expect(row.textContent).toContain("Refinement is paused");
  expect(row.querySelector("[title]")).toBeNull();
});
it("makes the whole nav row the activator", () => { ... });
it("shows a spinner and blocks clicks while loading", () => { ... });
it("labels an icon-only button", () => { ... });
it("marks decorative icons aria-hidden", () => { ... });
```

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement the five primitives**

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

### Task 11: C1, C2, C3, C4, C13, C16, C17

**Files:**
- Create: `src/components/header.ts`, `src/components/power-button.ts`, `src/components/feedback.ts`
- Test: `src/components/__tests__/chrome.test.ts`

**Interfaces:**
- Produces: `MainHeader({ pill })`, `SubHeader({ title, count?, onBack })`, `StatusPill(pill: Pill)`, `PowerButton({ on, compact, disabled, onToggle })`, `Banner({ tone: "warning" | "danger" | "info", text, action? })`, `EmptyState({ illustration, line, action })`, `FooterNote(text)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("gives the power button aria-pressed and an action label", () => {
  const b = PowerButton({ on: true, onToggle: () => {} });
  expect(b.getAttribute("aria-pressed")).toBe("true");
  expect(b.getAttribute("aria-label")).toBe("Turn prompt refinement off");
});
it("drops the power button to 104px when compact", () => { ... });
it("renders the back button at 44x44", () => { ... });
it("uses role=alert for a danger banner that blocks an action", () => { ... });
```

- [ ] **Step 2-5: fail, implement, pass, commit**

---

## Phase 4 — Screens (parallel after Phase 3: Tasks 12, 13; then 14, 15)

### Task 12: S1 Main and its eight states

**Files:**
- Create: `src/screens/main.ts`, `src/components/model-card.ts`
- Test: `src/screens/__tests__/main.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 7, 9, 10, 11.
- Produces: `export function MainScreen(ctx: ScreenContext): HTMLElement` and `export interface ScreenContext { settings: SettingsPort; providers: ProviderPort; navigate: (to: "platforms" | "models" | "providers") => void; tab: { origin: string; known: boolean } }`.

- [ ] **Step 1: Write the failing tests**

One test per state, each asserting the spec's exact copy:

```ts
it("1a renders Active with the refining title", () => {
  expect(screen.textContent).toContain("Refining your prompts");
  expect(screen.textContent).toContain("Press Enter to refine, again to send");
});
it("1b paused disables the site toggle and keeps settings", () => {
  expect(screen.textContent).toContain("Refinement is paused");
  expect(screen.textContent).toContain("Your prompts are sent exactly as you type them");
  expect(siteToggle(screen).disabled).toBe(true);
});
it("1c site off keeps the power on and names the site", () => {
  expect(screen.textContent).toContain("Off for claude.ai");
  expect(screen.textContent).toContain("Still on for your other platforms");
});
it("1d unsupported site offers Add this site and keeps the power button live", () => {
  expect(screen.textContent).toContain("No chat box found on this site");
  expect(powerButton(screen).disabled).toBe(false);
});
it("1e backup in use lists every slot and names the destination", () => {
  expect(screen.textContent).toContain("Refining with a backup model");
  expect(screen.textContent).toMatch(/prompt text is sent to Anthropic/i);
  expect(slots(screen)).toHaveLength(3);
});
it("1f no backup offers one button to add one", () => {
  expect(screen.textContent).toContain("Gemini Nano isn't available on this computer");
  expect(screen.textContent).toContain("Can't refine yet");
});
it("1g all failing warns that prompts go unchanged", () => {
  expect(screen.textContent).toContain("Prompts are being sent unchanged");
});
it("renders in one frame with no skeleton", () => {
  expect(screen.querySelector("[data-skeleton]")).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement `MainScreen` and `ModelCard`**

Hierarchy, top to bottom: power button, status sentence, site switch, model card, nav rows, footer. Under the compact rule, drop the power button to 104 and remove the footer note before anything scrolls.

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

### Task 13: S2 Platforms and its seven states

**Files:**
- Create: `src/screens/platforms.ts`
- Test: `src/screens/__tests__/platforms.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 10, 11.
- Produces: `export function PlatformsScreen(ctx: ScreenContext): HTMLElement`.

- [ ] **Step 1: Write the failing tests**

```ts
it("counts enabled platforms in the header", () => {
  expect(header(screen).textContent).toContain("5 of 6 on");
});
it("lists the current tab's platform first", () => { ... });
it("uses neutral monograms, not third-party logos", () => {
  expect(screen.querySelectorAll("img[src*='logo']")).toHaveLength(0);
});
it("2b all off shows the empty state and keeps the list", () => {
  expect(screen.textContent).toContain("No platforms are on, so nothing is refined.");
  expect(rows(screen)).toHaveLength(6);
});
it("2d disables Add with a reason when the tab cannot be added", () => {
  expect(screen.textContent).toContain("This tab can't be added");
});
it("2e shows a retry banner when permission is denied and adds no row", () => {
  expect(screen.textContent).toContain("Promptizer needs permission for this site to work on it.");
  expect(rows(screen)).toHaveLength(6);
});
it("2f offers Remove only on custom rows", () => { ... });
it("2g keeps the header and add button fixed while the list scrolls", () => { ... });
```

- [ ] **Step 2-5: fail, implement, pass, commit**

Adding a site calls `browser.permissions.request` for that origin and registers the content script at runtime; denial must leave settings untouched.

### Task 14: S3 Models, the chain UI, and keyboard drag

**Files:**
- Create: `src/screens/models.ts`, `src/components/model-slot.ts`
- Test: `src/screens/__tests__/models.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 7, 10, 11.
- Produces: `export function ModelsScreen(ctx: ScreenContext): HTMLElement`, `ModelSlot({ entry, index, onPick, onPromote, onRemove })`, `ModelPicker({ groups, selected, onSelect, onAddKey })`.

This is design record D3: a pinned primary card with no remove affordance, then a reorderable fallback chain of any length.

- [ ] **Step 1: Write the failing tests**

```ts
it("renders the primary as a card with no remove control", () => {
  expect(primaryCard(screen).querySelector("[data-remove]")).toBeNull();
  expect(primaryCard(screen).textContent).toContain("Always tried first");
});
it("labels fallbacks by position", () => {
  expect(fallbacks(screen)[0].textContent).toContain("1st fallback");
  expect(fallbacks(screen)[1].textContent).toContain("2nd fallback");
});
it("3b offers Add a fallback with the optional caption when there are none", () => {
  expect(screen.textContent).toContain("Optional. Used only when the primary can't run.");
});
it("3c dims other slots to 60% while the picker is open and closes on Escape", () => { ... });
it("3d keeps an unavailable model in place with a warning status", () => {
  expect(fallbacks(screen)[0].textContent).toContain("Key needed");
});
it("3e offers Download with a percentage and a progress bar", () => {
  expect(screen.textContent).toContain("Downloading 42%");
});
it("3g saves on change with no toast and no Save button", () => {
  expect(screen.querySelector("[data-toast]")).toBeNull();
  expect(writeSpy).toHaveBeenCalledTimes(1);
});
it("3h falls back to a free-text Model ID field when the list fails to load", () => {
  expect(screen.textContent).toContain("Couldn't load models. Try again");
  expect(screen.querySelector("input[name=model-id]")).not.toBeNull();
});
it("offers 3, 5, 10 and 20 second timeouts defaulting to 5", () => { ... });
it("promotes a fallback to primary from its overflow menu", () => {
  expect(writeSpy.mock.lastCall[0].chain[0].ref.modelId).toBe("claude-haiku");
});
it("moves a slot by keyboard and announces the new position", () => {
  handle.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
  handle.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
  expect(liveRegion(screen).textContent).toMatch(/Moved to position 1/);
});
it("cancels a keyboard drag on Escape without reordering", () => { ... });
```

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement the screen, the slot, and the picker**

Keyboard drag: Space lifts, arrows move, Space drops, Escape cancels. One `aria-live="polite"` region per screen. Pointer drag uses the same reducer as the keyboard path so only one reordering code path exists.

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

### Task 15: S4 Providers and keys

**Files:**
- Create: `src/screens/providers.ts`, `src/components/provider-row.ts`, `src/utils/provider-client.ts`
- Test: `src/screens/__tests__/providers.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 10, 11.
- Produces:

```ts
export interface TestResult { ok: boolean; state: "connected" | "invalid" | "unreachable" | "refused"; message: string; keyLast4?: string }
export interface ProviderInfo { id: ProviderId; label: string; subLabel: string; connected: boolean; keyLast4?: string; builtIn: boolean }
export interface ProviderPort {
  list(): Promise<ProviderInfo[]>;
  saveAndTest(id: ProviderId, key: string): Promise<TestResult>;
  removeKey(id: ProviderId): Promise<void>;
  models(id: ProviderId): Promise<ModelRef[]>;
}
export function ProvidersScreen(ctx: ScreenContext): HTMLElement;
```

- [ ] **Step 1: Write the failing tests**

```ts
it("lists Nano as built-in needing no key", () => {
  expect(rows(screen)[0].textContent).toContain("Built into Chrome, no key needed");
});
it("expands only one provider at a time", () => { ... });
it("4b disables Save & test until the field is non-empty", () => { ... });
it("4c makes the field read-only while testing", () => { ... });
it("4d collapses to the last four characters and never reveals a saved key", () => {
  expect(screen.textContent).toContain("Key ending 4f2a");
  expect(screen.querySelector("[data-reveal-saved]")).toBeNull();
});
it("4e keeps the key in the field and saves nothing when rejected", () => {
  expect(screen.textContent).toContain("didn't accept this key");
  expect(saveSpy).not.toHaveBeenCalled();
});
it("4f offers Try again and Save anyway when unreachable", () => { ... });
it("4g saves with a warning dot when the key works but the call is refused", () => {
  expect(result.state).toBe("refused");
  expect(spinner(screen)).toBeNull();
});
it("4i confirms removal inline, not in a modal", () => {
  expect(screen.querySelector("dialog")).toBeNull();
  expect(screen.textContent).toContain("Remove this key?");
});
it("4k marks Nano unavailable with a Why link", () => { ... });
it("never exposes a key to a content script", () => {
  expect(JSON.stringify(await fakeBrowser.storage.local.get(null))).not.toContain(rawKey);
});
```

The 4g assertion is Review Focus item 5: a 200 with an unparseable body resolves to `refused`, not a throw, and the button stops spinning.

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement the screen and `provider-client.ts`**

`provider-client.ts` implements `ProviderPort` over the paired `127.0.0.1:8765` service: the key is posted to the backend, never stored in extension storage (design record D5). `saveAndTest` has a 10s hard timeout and maps every non-2xx and every parse failure onto a `TestResult`, never a rejection.

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Commit**

### Task 16: Popup router

**Files:**
- Modify: `src/entrypoints/popup/main.ts`, `src/entrypoints/popup/index.html`
- Test: `src/entrypoints/popup/__tests__/router.test.ts`

**Interfaces:**
- Consumes: Tasks 12-15.
- Produces: `export function mount(root: HTMLElement, ctx: ScreenContext): void`.

- [ ] **Step 1: Write the failing tests**

```ts
it("always opens on S1", () => { ... });
it("focuses the power button on open", () => {
  expect(document.activeElement).toBe(powerButton(root));
});
it("focuses the back button after a push", () => { ... });
it("restores focus to the activated row after a pop", () => { ... });
it("goes back one level on Escape", () => { ... });
it("fixes the width at 360px and caps height at 580px", () => { ... });
it("truncates values before labels when space runs out", () => { ... });
it("exposes a truncated value in full via title and aria-label", () => { ... });
it("survives 40% text growth without shrinking type below 11px", () => {
  mount(root, ctxWithLocale("de"));
  expect(rowHeights(root).every(h => h >= 48)).toBe(true);
  expect(smallestFontSize(root)).toBeGreaterThanOrEqual(11);
});
it("holds its layout at 320px wide", () => { ... });
it("mirrors chevrons, back arrow and toggle direction under dir=rtl, keeping the power button centred", () => { ... });
it("delays a spinner until 300ms for network actions", () => {
  vi.advanceTimersByTime(299);
  expect(spinner(root)).toBeNull();
  vi.advanceTimersByTime(2);
  expect(spinner(root)).not.toBeNull();
});
```

Localization budget is 40% text growth, tested with German and Vietnamese strings; 48px rows grow to 56px rather than shrinking type (spec §9).

- [ ] **Step 2-5: fail, implement, pass, commit**

---

## Phase 5 — Content script

### Task 17: Port the logic modules

**Files:**
- Create: `src/utils/core.ts`, `src/utils/nano.ts`, `src/utils/adapters/{chatgpt,claude,registry}.ts`
- Move: `extension/tests/{core,nano,provider-router}.test.js` to `src/utils/__tests__/*.test.ts`

**Interfaces:**
- Produces: the same exported functions as the current `PromptizerCore` / `PromptizerNano` globals, as ES module exports with types.

- [ ] **Step 1: Convert the three existing test files to Vitest and TypeScript, changing no assertion**

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL — modules not found.

- [ ] **Step 3: Port `core.js` and `nano.js` to typed ES modules, changing no logic**

Drop the IIFE wrappers and the `globalThis` registration. Replace the `PromptizerAdapters` array with an explicit import list in `registry.ts`. Type Chrome's `LanguageModel` surface and keep the `available` / `downloadable` / `downloading` / `unavailable` mapping from spec §7.

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Run `make verify`; commit**

### Task 18: The chip and the content script

**Files:**
- Create: `src/entrypoints/content.ts`, `src/components/chip.ts`, `src/components/__tests__/chip.test.ts`

**Interfaces:**
- Consumes: Tasks 7, 8, 10, 17.
- Produces: `export function Chip(opts: { state: ChipState; modelLabel?: string; onUndo: () => void; onRetry: () => void }): HTMLElement` where `ChipState = "idle" | "refining" | "refined" | "refined-by-backup" | "failed"`.

This is the riskiest task in the plan. `writeEditor`'s logic must not change.

- [ ] **Step 1: Write the failing tests**

```ts
it("renders the five chip states with the spec's copy", () => {
  expect(chip("idle").textContent).toContain("Enter to refine");
  expect(chip("refining", "Gemini Nano").textContent).toContain("Refining with Gemini Nano");
  expect(chip("refined", "Gemini Nano").textContent).toContain("Refined, Gemini Nano");
  expect(chip("refined-by-backup", "Claude Haiku").textContent).toContain("(backup)");
  expect(chip("failed").textContent).toContain("Couldn't refine, Enter sends your original");
});
it("restores the exact original text and caret on undo", () => { ... });
it("lets the user edit refined text without re-refining", () => { ... });
it("never refines on Shift+Enter", () => { ... });
it("ignores input under three words", () => { ... });
it("tears the chip down and unbinds keydown when the platform is switched off", () => {
  expect(document.querySelector("#promptizer-extension-root")).toBeNull();
  expect(keydownListeners()).toHaveLength(0);
});
```

The last assertion is Review Focus item 3.

- [ ] **Step 2: Run them to verify they fail**

- [ ] **Step 3: Implement `content.ts` with `defineContentScript`**

`matches` from the enabled platforms, `runAt: "document_idle"`, `cssInjectionMode: "ui"`, and `createShadowRootUi` configured `mode: "closed"` — verify this rather than assuming it. Port `writeEditor`, `caretAtEnd`, `onKeydown` and the fingerprint guards verbatim from `extension/content.js`. Enter-to-refine is gated on `settings.refineOnEnter`, default off per design record D8. React to a settings change pushed from the background without a reload.

- [ ] **Step 4: Run them to verify they pass**

- [ ] **Step 5: Manual verification against `docs/manual-test.md` on both chatgpt.com and claude.ai, with a production build**

Expected: the chip appears, refines, replaces, and undoes on both sites.

- [ ] **Step 6: Commit**

### Task 19: Background worker

**Files:**
- Create: `src/entrypoints/background.ts`
- Test: `src/entrypoints/__tests__/background.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 8, 9, 15.
- Produces: message handlers `PROMPTIZER_REFINE`, `PROMPTIZER_CANCEL`, `PROMPTIZER_SETTINGS_CHANGED`.

- [ ] **Step 1: Write the failing tests**

```ts
it("sets the toolbar icon and tooltip from app state", () => {
  expect(setIconSpy.mock.lastCall[0].path).toMatch(/toolbar-backup/);
  expect(setTitleSpy.mock.lastCall[0].title).toBe("Using backup");
});
it("pushes a settings change to open tabs without a reload", () => { ... });
it("walks the chain snapshot and stops at the first success", () => { ... });
it("reports all-failing when the snapshot is exhausted", () => { ... });
it("honours the per-step timeout", () => { ... });
it("opens the popup, not an options page, on action click", () => { ... });
```

- [ ] **Step 2-5: fail, implement, pass, commit**

---

## Phase 6 — Cut over

### Task 20: Delete the old tree and rewire verification

**Files:**
- Delete: `extension/` in full
- Modify: `Makefile`, `README.md`, `eslint.config.mjs`, `package.json`, `docs/scope.md`

- [ ] **Step 1: Delete `extension/`, including `options.html`, `options.css` and `options.js`** (design record D6)

- [ ] **Step 2: Point ESLint at `src/`, add the TypeScript parser, and keep the no-comments rule**

- [ ] **Step 3: Update `Makefile:lint` and `Makefile:test-js`; add `wxt prepare` and `tsc --noEmit` to `test-js`**

- [ ] **Step 4: Run `make verify`**

Expected: PASS — go tests, race, vitest, eslint, tsc, manifest assertion, build.

- [ ] **Step 5: Update `README.md`**

Load-unpacked path becomes `.output/chrome-mv3`. Add `npm run dev`. Replace the options-page instructions with the popup. Update `docs/scope.md` to record that the provider framework and multi-platform support are now in scope, with keys held by the Go backend.

- [ ] **Step 6: Commit**

### Task 21: Whole-branch review

- [ ] **Step 1: Confirm every state in spec §7's matrix has a passing assertion**

Run: `npx vitest run --reporter=verbose` and check each of the 5 kinds x 4 screens.

- [ ] **Step 2: Re-verify the five Review Focus items**

- [ ] **Step 3: Check the accessibility list in spec §10 against the built popup**

- [ ] **Step 4: Run `make verify` and confirm the built manifest**

- [ ] **Step 5: Commit**

---

## Parallelism

| Wave | Tasks | Depends on |
|------|-------|------------|
| 1 | 1 | — |
| 2 | 2 → 3 → 4 → 5 | sequential; 2 gates everything |
| 3 | 6, 7, 9 in parallel | 3, 4 |
| 4 | 8, 10 in parallel | 7 / 4+5 |
| 5 | 11 | 10 |
| 6 | 12, 13 in parallel | 6, 9, 10, 11 |
| 7 | 14, 15 in parallel | 6, 7, 10, 11 |
| 8 | 16 | 12-15 |
| 9 | 17 | 3 |
| 10 | 18, 19 in parallel | 17, 8, 16 |
| 11 | 20 → 21 | all |

Task 18 must not be parallelised with anything that touches `src/utils/core.ts` or `src/utils/nano.ts`.
