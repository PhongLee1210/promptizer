# Translate Selected Text On Any Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Select text on any page, click a button, and read an on-device English↔Vietnamese translation in a read-only bubble, behind a build-time feature flag.

**Architecture:** A second content-script controller started from `src/entrypoints/content.ts` alongside `startChipController`, loaded by dynamic `import()` only when the flag is set. Three new modules: a UI-free wrapper over Chrome's Translator and LanguageDetector APIs, a shadow-DOM button plus read-only bubble, and a controller holding the selection listeners and lifecycle. No existing content module changes.

**Tech Stack:** TypeScript, WXT 0.21, Vitest + happy-dom, Chrome Translator API and LanguageDetector API (Chrome 138+), plain DOM in closed shadow roots.

**Spec:** `docs/superpowers/specs/2026-11-24-translate-on-page-design.md`

## Global Constraints

- pnpm only; run binaries with `pnpm exec`. Never `npm install`, never `npx`.
- No new runtime dependencies. No UI framework. No manifest, permission or `wxt.config.ts` change.
- No comments in the code except non-obvious *why*. Names and structure carry the meaning.
- Prettier: 2 spaces, semicolons, double quotes, trailing commas, `printWidth` 120.
- `import type` for type-only imports.
- Supported languages are exactly `en` and `vi`. Primary subtag match (`en-US` counts as `en`).
- `MAX_SELECTION_LENGTH = 1500`, `MIN_DETECTION_CONFIDENCE = 0.5`, `TRANSLATOR_IDLE_TIMEOUT_MS = 180_000`.
- **No fallbacks.** No retries, no alternative engine, no clipboard failure affordance, no guessed
  translation direction. `unavailable` and `error` are plain end states.
- Commit messages are ONE line, no body, no footer.
- Do not edit `.output/**`, `.wxt/**` or `src/utils/icons.ts`.

## Review Focus

1. **A stale translation must not replace a newer one.** Select, then select again before the first finishes — the bubble must show the second result, never the first. Pinned in Task 3.
2. **Clicking the button collapses the page selection.** The text and rect must be captured when the button is created, not re-read on click, or the translation runs on an empty selection. Pinned in Task 3.
3. **The detector returning nothing.** An empty results array, or every result below confidence, must reach `unsupported-language` rather than throwing. Pinned in Task 1.
4. **The bubble being torn off the page mid-flight.** A navigation or a DOM wipe while awaiting the translator must not throw from the resolved promise. Pinned in Task 3.
5. **Exactly-at-the-cap selections.** 1500 characters must be allowed and 1501 refused, so the boundary is not off by one. Pinned in Task 3.

---

### Task 1: Translator and detector wrapper

**Files:**
- Create: `src/content/translator.ts`
- Test: `src/content/__tests__/translator.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:

```ts
export type SupportedLanguage = "en" | "vi";
export type TranslatorAvailability = "available" | "downloadable" | "downloading" | "unavailable";

export interface TranslationDirection {
  readonly source: SupportedLanguage;
  readonly target: SupportedLanguage;
}

export interface LanguageDetectionResult {
  readonly detectedLanguage: string;
  readonly confidence: number;
}

export interface LanguageDetectorInstance {
  detect(text: string): Promise<LanguageDetectionResult[]>;
  destroy?(): void;
}

export interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?(): void;
}

export interface LanguageDetectorApi {
  availability(): Promise<TranslatorAvailability>;
  create(options: Record<string, unknown>): Promise<LanguageDetectorInstance>;
}

export interface TranslatorApi {
  availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<TranslatorAvailability>;
  create(options: Record<string, unknown>): Promise<TranslatorInstance>;
}

export interface TranslateOptions {
  translatorApi?: TranslatorApi;
  detectorApi?: LanguageDetectorApi;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export type TranslateOutcome =
  | { kind: "translated"; direction: TranslationDirection; text: string }
  | { kind: "unsupported-language" }
  | { kind: "unavailable" }
  | { kind: "error" };

export const MAX_SELECTION_LENGTH = 1500;
export const MIN_DETECTION_CONFIDENCE = 0.5;
export const TRANSLATOR_IDLE_TIMEOUT_MS = 180_000;

export function directionFrom(results: readonly LanguageDetectionResult[]): TranslationDirection | null;
export async function translateSelection(text: string, options?: TranslateOptions): Promise<TranslateOutcome>;
export function evictTranslators(): void;
```

The APIs default to `globalThis.Translator` and `globalThis.LanguageDetector` when the options omit them, the way `getLanguageModel` in `nano.ts` reads `globalThis.LanguageModel`.

- [ ] **Step 1: Write the failing tests for `directionFrom`**

```ts
it("maps the highest-confidence English result to en→vi", () => {
  expect(directionFrom([{ detectedLanguage: "en", confidence: 0.9 }])).toEqual({ source: "en", target: "vi" });
});

it("maps Vietnamese to vi→en", () => {
  expect(directionFrom([{ detectedLanguage: "vi", confidence: 0.8 }])).toEqual({ source: "vi", target: "en" });
});

it("matches on the primary subtag", () => {
  expect(directionFrom([{ detectedLanguage: "en-US", confidence: 0.7 }])).toEqual({ source: "en", target: "vi" });
});

it("takes the highest-confidence result, not the first", () => {
  const results = [
    { detectedLanguage: "fr", confidence: 0.2 },
    { detectedLanguage: "vi", confidence: 0.9 },
  ];
  expect(directionFrom(results)).toEqual({ source: "vi", target: "en" });
});

it("returns null below the confidence floor", () => {
  expect(directionFrom([{ detectedLanguage: "en", confidence: 0.49 }])).toBeNull();
});

it("returns null for an unsupported language and for no results", () => {
  expect(directionFrom([{ detectedLanguage: "ja", confidence: 0.99 }])).toBeNull();
  expect(directionFrom([])).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/content/__tests__/translator.test.ts`
Expected: FAIL — `directionFrom` is not exported.

- [ ] **Step 3: Implement the constants, the types and `directionFrom` in `src/content/translator.ts`**

`directionFrom` picks the maximum-confidence entry, drops it if confidence is below
`MIN_DETECTION_CONFIDENCE`, reduces the tag to its primary subtag, and maps `en`→`vi`, `vi`→`en`,
anything else to `null`.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm exec vitest run src/content/__tests__/translator.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing tests for `translateSelection`**

Fakes mirror `nano.test.ts`: plain objects with `vi.fn()` for `availability`, `create`, `detect`,
`translate` and `destroy`.

```ts
it("detects, translates, and reports the direction", async () => {
  const outcome = await translateSelection("The minister was reluctant.", { detectorApi, translatorApi });
  expect(outcome).toEqual({ kind: "translated", direction: { source: "en", target: "vi" }, text: "Bộ trưởng..." });
});

it("returns unsupported-language without creating a translator", async () => {
  // detector yields ja
  expect(await translateSelection("これは日本語です", { detectorApi, translatorApi })).toEqual({
    kind: "unsupported-language",
  });
  expect(translatorApi.create).not.toHaveBeenCalled();
});

it("returns unavailable when the detector is unavailable", async () => { /* detector availability → "unavailable" */ });

it("returns unavailable when the translator pair is unavailable", async () => { /* translator availability → "unavailable" */ });

it("returns unavailable when the APIs are absent", async () => {
  expect(await translateSelection("hello", {})).toEqual({ kind: "unavailable" });
});

it("returns error when create rejects with NotSupportedError", async () => { /* → { kind: "error" } */ });

it("returns error when translate rejects", async () => { /* → { kind: "error" } */ });

it("reports download progress through onProgress", async () => {
  // create() invokes the monitor with downloadprogress events; expect onProgress to receive 0 then 100
});

it("reuses a cached translator for the same direction and creates one per direction", async () => {
  await translateSelection("hello", { detectorApi, translatorApi });
  await translateSelection("world", { detectorApi, translatorApi });
  expect(translatorApi.create).toHaveBeenCalledTimes(1);
});

it("destroys cached instances on evictTranslators", async () => {
  await translateSelection("hello", { detectorApi, translatorApi });
  evictTranslators();
  expect(translatorInstance.destroy).toHaveBeenCalled();
});
```

Add `beforeEach(() => evictTranslators())` at the top of the file, as `nano.test.ts` does with
`evictWarmSessions`.

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm exec vitest run src/content/__tests__/translator.test.ts`
Expected: FAIL — `translateSelection` is not exported.

- [ ] **Step 7: Implement `translateSelection` and `evictTranslators`**

Order: resolve both APIs (absent → `unavailable`); detector availability; create or reuse the cached
detector; `detect`; `directionFrom` (null → `unsupported-language`); translator availability for the
pair (not `available` after creation attempt → `unavailable`); create or reuse the cached translator
for that direction, passing a `monitor` that forwards `downloadprogress` to `onProgress`; `translate`.
Any rejection → `error`.

The cache holds at most one detector and one translator per direction, each with an idle timer of
`TRANSLATOR_IDLE_TIMEOUT_MS` that destroys and drops the entry. `evictTranslators` clears the timers
and destroys everything immediately.

- [ ] **Step 8: Run them to verify they pass**

Run: `pnpm exec vitest run src/content/__tests__/translator.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/content/translator.ts src/content/__tests__/translator.test.ts
git commit -m "feat: add on-device en/vi translator wrapper"
```

---

### Task 2: Trigger button and read-only bubble

**Files:**
- Create: `src/content/translate-bubble.ts`
- Test: `src/content/__tests__/translate-bubble.test.ts`

Both UI pieces live in this one module: they share the style constant and the shadow-host pattern, and
the spec's file budget is three new modules.

**Interfaces:**
- Consumes: `TranslationDirection` from `src/content/translator.ts` (Task 1).
- Produces:

```ts
export type BubbleState =
  | { kind: "detecting" }
  | { kind: "downloading"; percent: number }
  | { kind: "ready"; direction: TranslationDirection; text: string }
  | { kind: "unsupported-language" }
  | { kind: "unavailable" }
  | { kind: "error" };

export interface TranslateBubbleCallbacks {
  onCopy: () => void;
  onClose: () => void;
}

export const BUBBLE_HEIGHT = 220;
export const TRANSLATE_BUBBLE_STYLE: string;

export class TranslateButton {
  constructor(onClick: () => void);
  node(): HTMLDivElement;
  mountAt(rect: Rect): void;
  destroy(): void;
  containsEventTarget(event: Event): boolean;
}

export class TranslateBubble {
  constructor(callbacks: TranslateBubbleCallbacks);
  node(): HTMLDivElement;
  mount(): void;
  render(state: BubbleState): void;
  positionAt(rect: Rect, viewport: Viewport): void;
  containsEventTarget(event: Event): boolean;
  destroy(): void;
}
```

Both classes build a host `div`, call `attachShadow({ mode: "closed" })`, and set the shadow's style
text to `designTokens + TRANSLATE_BUBBLE_STYLE` — the `chip.ts` pattern, importing
`../styles/tokens.css?inline`. Both hosts take z-index `2147483647`, set `popover="manual"` and call
`showPopover()` so top-layer sites cannot cover them. The button's icon comes from `icon("globe")`.
`positionAt` applies `placePanel(rect, BUBBLE_HEIGHT, viewport)` from `./anchor` the way
`chip.applyPanelPlacement` consumes a `PanelPlacement`.

- [ ] **Step 1: Write the failing tests**

```ts
it("renders the direction and the translated text when ready", () => {
  bubble.render({ kind: "ready", direction: { source: "en", target: "vi" }, text: "miễn cưỡng" });
  expect(bubble.node().shadowRoot).toBeNull();          // closed shadow root
  expect(hostText(bubble)).toContain("miễn cưỡng");
});

it("shows a percentage while downloading", () => { /* { kind: "downloading", percent: 42 } → "42" */ });

it("states that only English and Vietnamese are supported", () => { /* unsupported-language */ });

it("states that translation is unavailable", () => { /* unavailable */ });

it("shows no copy button unless the state is ready", () => { /* detecting, error → no copy control */ });

it("invokes onCopy and onClose from their controls", () => { /* click each, expect the callback */ });

it("reports whether an event target is inside its host", () => { /* containsEventTarget */ });

it("places the bubble from the selection rect", () => {
  bubble.positionAt(rectAt(100, 300), { width: 1440, height: 900 });
  // expect the host's inline bottom/right insets to match placePanel's output
});

it("mounts the button at the selection rect and removes it on destroy", () => { /* TranslateButton */ });

it("calls its click handler once", () => { /* TranslateButton */ });
```

A `hostText` helper reads the closed shadow content via the reference the class exposes internally in
tests; follow whatever access `chip.test.ts` already uses for the same problem.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/content/__tests__/translate-bubble.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TRANSLATE_BUBBLE_STYLE`, `TranslateButton` and `TranslateBubble`**

Styling uses the existing `--pz-*` tokens only; no new colour or spacing values. The ready state shows
one line of "English → Vietnamese", the translated text, a copy button and a close button, and nothing
else. `onCopy` is wired by the controller, not by this module.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm exec vitest run src/content/__tests__/translate-bubble.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/content/translate-bubble.ts src/content/__tests__/translate-bubble.test.ts
git commit -m "feat: add translate selection button and read-only bubble"
```

---

### Task 3: Selection controller

**Files:**
- Create: `src/content/selection-translate.ts`
- Test: `src/content/__tests__/selection-translate.test.ts`

**Interfaces:**
- Consumes: `translateSelection`, `evictTranslators`, `MAX_SELECTION_LENGTH`, `TranslateOutcome`,
  `TranslateOptions` from Task 1; `TranslateButton`, `TranslateBubble`, `BubbleState` from Task 2;
  `isGloballyEnabled`, `onGlobalEnabledChanged` from `./global-enabled`; `resolveEditableTarget`,
  `isContentEditableElement` from `./editor-detector`; `Rect` from `./anchor`.
- Produces:

```ts
export interface SelectionCandidate {
  readonly text: string;
  readonly rect: Rect;
}

export interface SelectionTranslateOptions {
  translate?: (text: string, options: TranslateOptions) => Promise<TranslateOutcome>;
  globallyEnabled?: () => Promise<boolean>;
}

export function selectionCandidate(selection: Selection | null, target: EventTarget | null): SelectionCandidate | null;
export function startSelectionTranslate(options?: SelectionTranslateOptions): () => void;
```

- [ ] **Step 1: Write the failing tests for `selectionCandidate`**

```ts
it("accepts a plain text selection and returns its text and rect", () => { /* → { text, rect } */ });

it("rejects an empty, collapsed or whitespace-only selection", () => { /* → null for each */ });

it("rejects a selection whose bounding rect has no size", () => { /* → null */ });

it("accepts exactly 1500 characters and rejects 1501", () => {
  expect(selectionCandidate(selectionOf("a".repeat(1500)), textNodeTarget)).not.toBeNull();
  expect(selectionCandidate(selectionOf("a".repeat(1501)), textNodeTarget)).toBeNull();
});

it("rejects a selection inside a textarea or a contenteditable", () => { /* → null for both */ });

it("rejects a mouseup on a link the selection does not cover", () => { /* → null */ });

it("accepts a sentence selection that contains a link", () => { /* intersectsNode → not null */ });

it("rejects a mouseup inside a Promptizer host", () => {
  const host = document.createElement("div");
  host.setAttribute("data-promptizer-pill", "");
  expect(selectionCandidate(selectionOf("refined text"), host)).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/content/__tests__/selection-translate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `selectionCandidate`**

Checks in order: a non-collapsed selection with at least one range; trimmed text non-empty and at most
`MAX_SELECTION_LENGTH`; the range's bounding rect has non-zero width and height; the anchor is not
inside an editable (`resolveEditableTarget` / `isContentEditableElement`); the target has no
`data-promptizer-pill` ancestor; and no interactive ancestor (`A`, `BUTTON`, `INPUT`, `TEXTAREA`,
`SELECT`, or an interactive `role`) unless `range.intersectsNode()` says the selection covers it.

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm exec vitest run src/content/__tests__/selection-translate.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing tests for `startSelectionTranslate`**

```ts
it("shows the button on a valid mouseup and translates on click", async () => { /* bubble shows the text */ });

it("shows no button when Promptizer is globally disabled", async () => { /* globallyEnabled → false */ });

it("hides the button when the global switch flips off", async () => { /* onGlobalEnabledChanged */ });

it("translates the text captured at button creation, not at click time", async () => {
  // after the button appears, collapse the document selection, then click
  expect(translate).toHaveBeenCalledWith("reluctant", expect.anything());
});

it("ignores a stale translation when a newer selection superseded it", async () => {
  // first translate resolves after the second; the bubble must show the second result
});

it("does not throw when the host is removed while a translation is in flight", async () => {
  // remove the bubble host from the document before the promise resolves
});

it("removes the button on a mousedown elsewhere", () => { /* no button node left */ });

it("closes the bubble on Escape and on an outside click", () => { /* two cases */ });

it("evicts cached translators when the returned stop function runs", () => { /* evictTranslators called */ });
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm exec vitest run src/content/__tests__/selection-translate.test.ts`
Expected: FAIL — `startSelectionTranslate` is not exported.

- [ ] **Step 7: Implement `startSelectionTranslate`**

A document `mouseup` listener in capture phase builds a candidate and mounts a `TranslateButton` at
its rect, holding the candidate's text. The button's click mounts the bubble, renders `detecting`, and
calls `translate(text, { onProgress })`, rendering `downloading` from progress and then the outcome's
matching `BubbleState`.

A monotonically increasing generation counter, incremented on every new candidate and on close,
guards the resolved promise: a result from an older generation is dropped. This is the same pattern
`startChipController` uses for `generation`.

A `mousedown` outside the button destroys it; Escape or a click outside the bubble closes it. The
returned stop function removes every listener, destroys the button and bubble, unsubscribes from
`onGlobalEnabledChanged` and calls `evictTranslators`.

- [ ] **Step 8: Run them to verify they pass**

Run: `pnpm exec vitest run src/content/__tests__/selection-translate.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/content/selection-translate.ts src/content/__tests__/selection-translate.test.ts
git commit -m "feat: add selection translate controller"
```

---

### Task 4: Flag wiring, env cleanup and docs

**Files:**
- Modify: `src/entrypoints/content.ts`
- Modify: `.env.example`
- Modify: `docs/features.md`, `docs/architecture.md`

**Interfaces:**
- Consumes: `startSelectionTranslate` from Task 3.
- Produces: nothing for later tasks.

- [ ] **Step 1: Gate the controller behind the flag in `src/entrypoints/content.ts`**

Inside the existing `main()`, after `startChipController()`, add:

```ts
if (import.meta.env.WXT_FEATURE_TRANSLATE_ON_PAGE === "true") {
  void import("../content/selection-translate").then((module) => module.startSelectionTranslate());
}
```

The dynamic import is deliberate: it keeps the three modules out of a disabled build rather than
relying on Rollup's side-effect analysis.

- [ ] **Step 2: Rewrite `.env.example`**

It becomes exactly:

```sh
# Copy to .env to enable features that are not released yet.
WXT_FEATURE_TRANSLATE_ON_PAGE=false
```

The former `GROQ_API_KEY` and `PROMPTREFINE_*` entries go: they described the removed Go CLI / Groq
cloud fallback, the only consumer (`bin/promptrefine`) is an untracked local binary, and nothing in
`src/` reads env.

- [ ] **Step 3: Document the feature**

`docs/features.md` gains a section marked as flag-gated covering: the selection trigger and its
exclusions, en↔vi only with automatic detection, read-only with copy and close, no fallbacks, and the
Edge caveat (if Edge lacks the APIs the bubble shows `unavailable` and the feature is Chrome-only in
practice). `docs/architecture.md` gains a short paragraph on the three modules, the content-script-only
placement forced by the APIs being unavailable in workers, and the user-activation requirement.

- [ ] **Step 4: Verify the flag off and on**

Run: `make verify`
Expected: typecheck, Vitest, Prettier and build all pass.

Run: `pnpm run build && grep -rl "pz-translate" .output/chrome-mv3/ | wc -l`
Expected: `0` with no `.env` flag set — the modules are absent from a disabled build.

Run with the flag enabled in `.env`: the same grep finds the bundle.

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/content.ts .env.example docs/features.md docs/architecture.md
git commit -m "feat: gate translate on page behind WXT_FEATURE_TRANSLATE_ON_PAGE"
```

- [ ] **Step 6: Manual pass, Chrome then Edge**

With `WXT_FEATURE_TRANSLATE_ON_PAGE=true`, load `.output/chrome-mv3/` unpacked and check: an English
article, a Vietnamese article, a selection in a composer on a supported platform (no button, chip
unchanged), a page that renders in the top layer, a selection past 1500 characters (no button), and a
selection inside Promptizer's own result window (no button). Repeat in Edge and record which Edge
outcome is real in `docs/features.md`.
