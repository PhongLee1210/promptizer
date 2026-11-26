# Translate selected text on any page — design

Date: 2026-11-24
Status: approved 2026-11-24
Reviewed: builder check done 2026-11-24; its eight questions are resolved in §5, §8.2, §8.3, §8.4,
§8.5, §8.6 and §10.

## 1. Intent and why

Promptizer today only acts on text a user is *writing* in a composer. This feature lets a user
translate text they are *reading*: select text on any page, click a small button, read the
translation in a bubble, copy it if wanted, close it.

The why, as given: the behaviour exists in another product
(`docs/features/extension-translate-on-page.md`) and should exist in Promptizer as well, as its own
feature — separate from the prompt chip, not mixed with it, but structured so it can grow later.
Release is controlled by a build-time feature flag so the feature can sit in `main` unfinished
without shipping.

It runs fully on-device. Selected text never leaves the machine, which keeps the repo's standing
privacy invariant intact.

## 2. Goals

- Select text on a page → translate it between English and Vietnamese, on-device.
- Read-only: show the translation, allow copy, allow close. Nothing else.
- Source language detected automatically; target is "the other one" of en/vi.
- Zero interference with the prompt chip: neither feature can trigger where the other is active.
- Off unless `WXT_FEATURE_TRANSLATE_ON_PAGE=true` is present at build time.
- Structured for growth: a later "send to prompt" bridge, or more languages, is additive.

## 3. Non-goals (this change)

- Whole-page translation. Explicitly excluded by the user.
- Any connection to the chip, the action rail, the result window, or the nine Nano actions.
- A right-click "Translate selection" menu item — it would need the `contextMenus` permission, and
  manifest/permission changes are "ask first" per AGENTS.md.
- `all_frames: true` injection, per-site language memory, `storage.sync`, a `<html lang>` walk,
  an "autodetect language" setting, double-click / double-Shift triggers, a mobile "Look up" button,
  Safari builds, analytics.
- Languages beyond `en` and `vi`.

## 4. Anti-goals (would make this a failure even if it works)

- The bubble appearing on ordinary selections users make for copying, or over form fields and
  composers — the feature must not make normal page use feel hijacked.
- Any coupling that means a change to the chip can break translation, or the reverse.
- Any path where selected page text is logged, stored, or sent anywhere.
- A flag that ships enabled by accident.

## 5. Constraints

**From the platform** (verified against Chrome and MDN docs, 2026-11-24):

- Translator API supports `vi`; available Chrome 138+, which matches the manifest's
  `minimum_chrome_version: 138`.
- Neither Translator nor LanguageDetector is available in workers — only top-level windows and
  same-origin iframes. The content script is therefore the only possible home; the source document's
  "keep the model session in the service worker" design is impossible here. (The repo has no
  background entrypoint anyway.)
- `create()` **requires user activation**. No prewarming on page load, unlike `prewarmNano()`.
  The translator is created inside the button's click handler.
- First use downloads a language pack; `create()` reports progress via a monitor.
- Desktop only. Edge support is listed inconsistently in Chrome's own docs. **Decided: ship anyway.**
  If Edge lacks the APIs, Edge users get the `unavailable` bubble and the feature is Chrome-only in
  practice; it does not block enabling the flag. AGENTS.md's Chrome + Edge promise carries a
  documented exception for this feature, recorded in `docs/features.md`.
- If a language pair is unsupported, `create()` throws `NotSupportedError` and no download starts.

**From the project** (AGENTS.md, `.claude/rules/coding-conventions.md`):

- No runtime dependencies, no UI framework. Plain DOM in a closed shadow root, styled by a module
  `*_STYLE` constant plus `styles/tokens.css?inline` — the pattern `chip.ts` already uses.
- pnpm only; `pnpm exec` for binaries. Commit messages one line.
- No comments except for non-obvious why. Intention-revealing names, no magic numbers.
- Pure functions get Vitest tests in the neighbouring `__tests__/`; browser behaviour is verified by
  loading `.output/chrome-mv3/` unpacked.
- No manifest, permission, or dependency change is needed for this feature, and none is made.

## 6. Approaches considered

**A — Separate controller, shared primitives. Chosen.**
A second controller started from `src/entrypoints/content.ts` alongside `startChipController`, behind
the flag. It owns its selection listeners, its own read-only bubble, and a thin wrapper over
Translator + LanguageDetector. It reuses the existing `anchor.ts` placement helpers, the design
tokens, and the download-progress shape from `nano.ts`. No existing content module is modified.
*Trade-off:* three new files under `src/content/`. Approved by the user.

**B — Extend the existing chip controller** with a selection trigger and a new view kind in
`chip-state.ts`. Rejected: it mixes the two features in the one reducer, which is exactly what the
user ruled out, and `chip-state.ts` is entirely editor-centric (`editor-left`, `replaced`, `undone`).

**C — A second content script entrypoint** with its own bundle. Rejected: strongest isolation, but it
injects a second content script into every page, duplicates listeners and styles, and forces the flag
into `wxt.config.ts` manifest generation. Over-engineered for a read-only bubble.

## 7. What the source document contributes, and what is dropped

`docs/features/extension-translate-on-page.md` describes a different product — a language-learning
extension with flashcards, decks, a StencilJS component library, a monorepo of `@app/extension-*`
packages, PostHog, payment polling and Safari/iOS builds. It is kept as reference only. This design
does not implement it. The audit:

| Source doc | Decision here | Reason |
| --- | --- | --- |
| Selection button next to the text, placed above/below the selection | **Port** (adapted) | Good interaction, and conservative: no popup until the user asks for one. |
| `isValidSelection` rejections: no range, zero-size rect, whitespace-only | **Port** | Cheap correctness. |
| Ignore clicks on links, buttons and form controls | **Port** (adapted) | Prevents hijacking normal page interaction. |
| Max selection length | **Adapt**: 1500 chars, not 150 | The 150-char cap existed because the other product prompted an LLM per word. The Translator API handles paragraphs; the cap here only keeps the bubble a bubble. |
| Service worker owns the model session; typed `@app/extension-messages` bus | **Drop** | The APIs do not exist in workers, and this repo has no background entrypoint. |
| StencilJS web components | **Drop** | No UI framework allowed. Plain DOM in a closed shadow root instead. |
| Language resolution: per-site memory → saved pair → `<html lang>` walk → fallback | **Drop, replaced** | All four steps were workarounds for not having a detector. LanguageDetector reads the selected text directly, which is strictly more accurate than a page-level `lang` attribute. |
| `autodetectLanguage` setting, `storage.sync` hostname map | **Drop** | Nothing left to configure once detection is automatic; repo uses `storage.local`. |
| Sentence-context extraction (DOM sibling walk, `.` terminator, `tokenize()`) | **Drop** | It exists to disambiguate a single word for a dictionary lookup. Translating the user's actual selection needs no surrounding context. |
| Lemma / part of speech / flashcards / decks / "Learn" / card limits / spaced repetition | **Drop** | Vocabulary-app features. Promptizer has no deck concept. |
| Double-click, double-Shift hotkey, context menu, `all_frames`, mobile button, Lemur/Safari quirks | **Drop (for now)** | Each is an extra trigger surface or a platform this repo does not target (Chrome + Edge, desktop). The click-the-button path is the one trigger. |
| Nested popup stack (select inside a popup → second popup) | **Drop** | Read-only bubble; no reason to translate a translation. |
| PostHog analytics | **Drop** | No runtime dependencies, and it would send page-derived data off-device. |
| Top-layer `showPopover()` trick, max z-index | **Port** | Real problem on sites that render in the browser top layer. |

## 8. The design

### 8.1 Files

New, under `src/content/`:

- `translator.ts` — the only place that touches `Translator` and `LanguageDetector`. Exports the
  availability check, the detect call, the translate call, and the API types so tests can inject
  fakes. Modelled on `nano.ts`: injectable API object, no DOM, no UI. It owns a session cache
  (§8.6); it is UI-free, not stateless.
- `selection-translate.ts` — the controller: selection listeners, validity rules, exclusion rules,
  lifecycle, and the `startSelectionTranslate()` entry point returning a stop function (same shape as
  `startChipController`).
- `translate-bubble.ts` — the read-only bubble: closed shadow root, `TRANSLATE_BUBBLE_STYLE`, a
  callbacks object (`onCopy`, `onClose`), and render states.

New tests, under `src/content/__tests__/`: `translator.test.ts`, `selection-translate.test.ts`,
`translate-bubble.test.ts`.

Modified:

- `src/entrypoints/content.ts` — reads the flag and conditionally starts the controller.
- `.env.example` — documents the flag, and loses its stale `GROQ_API_KEY` and `PROMPTREFINE_*`
  entries. Those described the removed Go CLI / Groq cloud fallback; the only thing that ever read
  them, `bin/promptrefine`, is an untracked local Mach-O binary, and nothing in `src/` reads env at
  all. `.env.example` is the one tracked file under either path, so this is a two-line cleanup in the
  file the feature already has to touch, not a separate concern.
- `docs/features.md`, `docs/architecture.md` — a short section each, marked flag-gated.

No other existing file is touched. `wxt.config.ts` and the manifest are unchanged.

### 8.2 Feature flag

`.env` (gitignored) and `.env.example` (committed) carry:

```sh
WXT_FEATURE_TRANSLATE_ON_PAGE=true
```

`src/entrypoints/content.ts` starts the controller only when
`import.meta.env.WXT_FEATURE_TRANSLATE_ON_PAGE === "true"`. Any other value, and absence, means off.
Because `.env` is gitignored, CI and release builds get the feature disabled with no further action —
which is the intended default until it is ready.

The three modules are loaded with a **dynamic `import()` inside that branch**, not a static import at
the top of the entrypoint. A static import would leave elimination up to Rollup's side-effect
judgement; a dynamic one makes the flag genuinely exclude the code from a disabled build, which is
what §10 verifies. This is the repo's first `import.meta.env` flag, so it sets the pattern for later
ones.

The flag is read in the entrypoint only. The controller and its modules know nothing about it, so
unit tests exercise them regardless of the local environment.

### 8.3 Trigger and exclusions

A document-level `mouseup` listener in capture phase. The controller shows the button when all hold:

- Promptizer is globally enabled (`isGloballyEnabled()` from `global-enabled.ts`, kept in sync via
  `onGlobalEnabledChanged`) — the popup's master switch turns this feature off too.
- The selection is non-empty after trimming, has at least one range, and its bounding rect has
  non-zero width and height.
- Its text is at most 1500 characters. The cap is a **trigger precondition, not a bubble state**: on a
  longer selection no button appears at all. A user who selects three paragraphs to copy them should
  see nothing, which is what the anti-goals ask for, and it keeps the state list smaller.
- The selection is **not** inside an editable target — checked with `resolveEditableTarget` and
  `isContentEditableElement` from `editor-detector.ts`. This is the single rule that makes the two
  features disjoint: the chip owns editable elements, translation owns everything else.
- The `mouseup` did not land on an interactive element that the selection does not cover. Concretely:
  walk the target's ancestors for `A`, `BUTTON`, `INPUT`, `TEXTAREA`, `SELECT` or an element with an
  interactive `role`; if one is found, suppress the button unless `range.intersectsNode()` says the
  selection actually covers it. The containment test is what lets a user select a sentence that
  happens to contain a link and still get a translation, while a plain click on a link stays a click.
- The `mouseup` did not originate inside one of Promptizer's own hosts. The chip host carries
  `data-promptizer-pill` and a closed shadow root, so a page-level selection cannot reach into the
  rail or the result window, but the click target can still be the host element. Suppressing on that
  attribute keeps the translate button off Promptizer's own UI, which the "zero interference"
  anti-goal requires.

Clicking the button creates the translator (user activation is live at that moment) and opens the
bubble. A `mousedown` anywhere else removes the button. Escape or a click outside closes the bubble.

The button and bubble hosts use the maximum 32-bit z-index and are promoted to the top layer with
`showPopover()` on a `popover="manual"` element, so sites that render their own UI in the top layer
cannot cover them.

### 8.4 Language resolution

1. `LanguageDetector` on the selected text.
2. Take the highest-confidence result. If its confidence is below 0.5, treat the language as unknown.
3. Match on the **primary subtag only**: `en-US`, `en-GB` and `en` all count as `en`. Exact-equality
   matching would send most real pages to the unsupported path and make the feature look broken.
4. `en` → translate to `vi`. `vi` → translate to `en`.
5. Anything else, or unknown: the bubble says only English and Vietnamese are supported, and no
   translation is attempted.

`LanguageDetector` is a separate API with its own availability states and its own model download, and
it runs inside the same click. It gets the same treatment as the Translator: both are reached through
`translator.ts`, and the bubble reports one combined progress line rather than two phases. If the
detector itself is unavailable, the bubble shows `unavailable` — the feature never guesses a
direction.

There is no stored language preference, no per-site memory, and no setting. The direction is a
function of the text alone.

### 8.5 Bubble states

- `detecting` / `translating` — a short progress line.
- `downloading` — percentage from the `create()` monitor, same progress shape the chip uses for Nano.
- `ready` — "English → Vietnamese" (or the reverse), the translated text, a copy button, a close
  button.
- `unsupported-language` — the en/vi-only note.
- `unavailable` — translation is not available in this browser.
- `error` — a generic failure line. No retry in v1; the user can reselect.

There is no `too-long` state: the cap is enforced before the button appears (§8.3).

**No fallbacks anywhere.** The copy button calls `navigator.clipboard.writeText` and nothing more —
no failure affordance, no alternative copy path, no `clipboardWrite` permission. `unavailable` and
`error` are plain end states: the feature says what happened and stops. It never retries, never
substitutes another engine, and never guesses a translation direction it could not detect.

Placement reuses `placePanel` and `clamp` from `anchor.ts` with the bubble's own size constants,
so `anchor.ts` itself is not modified.

### 8.6 Session lifecycle

A `Translator` holds a model session and is expensive to build, which is why `nano.ts` keeps warm
templates with idle eviction instead of creating per request. `translator.ts` does the same: at most
one translator per direction (en→vi, vi→en) and one detector, cached, with an idle timeout that
destroys them — mirroring `nano.ts`'s `TEMPLATE_IDLE_TIMEOUT_MS` rather than inventing a second
policy. Creating per translation would re-pay availability and creation latency on every lookup;
never destroying would leak a session per selection.

The cache is created lazily inside the click handler, so the user-activation requirement still holds
for the first use. `startSelectionTranslate()`'s stop function evicts it, the way
`stopChipController` calls `releaseWarmSessions()`.

### 8.7 Growth hooks

- `translator.ts` is UI-free, so a future whole-page mode or a chip integration can call it without
  touching the controller.
- The bubble takes a callbacks object, so a later "send to prompt" is one added callback, not a
  rewrite.
- The language pair lives in one place in `translator.ts`; adding a language is a change there plus
  the detector's accepted set.
- The flag is per-feature, so later sub-features can get their own.

## 9. Privacy

Selected text goes only to the on-device Translator and LanguageDetector. Nothing is persisted,
nothing is logged, no network call is made. This matches the repo's existing invariant that only
explicitly selected, bounded text is ever acted on and prompt content is never logged.

## 10. Verification

- `make verify` (typecheck, Vitest, Prettier, build) must pass.
- New unit tests cover: the validity and exclusion rules, direction selection from a detector result
  including the low-confidence and unsupported cases, each bubble state, and translator error paths
  (`NotSupportedError`, unavailable, download progress) with injected fakes.
- Manual check, with `WXT_FEATURE_TRANSLATE_ON_PAGE=true`, loading `.output/chrome-mv3/` unpacked:
  an English article page, a Vietnamese article page, a selection inside a composer on a supported
  platform (must show no button, and the chip must behave exactly as before), a page that renders in
  the top layer, a long selection past the cap (no button may appear), and a selection inside
  Promptizer's own result window (no button may appear).
- A build **without** the flag must not contain the three modules at all: verified by grepping
  `.output/chrome-mv3/` for a string unique to the bubble, as well as by the chip behaving unchanged.
- The same manual pass repeated in Edge, to record which of the two Edge outcomes is real. It is not a
  release gate (§5); the result goes into `docs/features.md`.

## 11. Left to the builder

- Exact bubble dimensions, spacing and copy wording, within the existing design tokens.
- Internal function and constant naming, and how the controller's render function is split.
- Which icon from `src/assets/icon-sources/` the trigger button uses (`globe.svg` is the obvious
  candidate; `src/utils/icons.ts` is build-generated and must not be hand-edited).
- Debounce or timing details on the selection listener, if the manual pass shows flicker.
- Test file organisation beyond the three named files.
