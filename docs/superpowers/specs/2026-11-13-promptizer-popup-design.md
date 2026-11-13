# Promptizer popup + WXT migration: design record

Date: 2026-11-13
Status: approved to execute
Source spec: `docs/design/promptizer-package/PLAN.md` (633 lines, 38 assets)

## Intent

Promptizer is an integration application, not just a browser extension. The Go service is the
backend and the long-term integration hub; the extension is one client of it. This phase delivers
the extension's 4-screen popup UI to match `docs/design/promptizer-package/PLAN.md`, on a WXT +
Vite toolchain, with a provider-agnostic model-order engine.

## Goals

- Implement S1-S4 and the in-page chip faithfully, including every state in the spec's state matrix.
- Migrate the extension from hand-written MV3 to WXT + Vite + vanilla TypeScript.
- Make the model chain provider-agnostic: Gemini Nano is the default primary, but nothing in the
  UI or the data model assumes it.
- Keep `make verify` green at every step.

## Non-goals (this phase)

- Light theme. Tokens are semantic so it is a second value set later, not a redesign.
- Real adapters for Gemini, Perplexity, Copilot, DeepSeek. The Platforms screen is built for six
  plus user-added sites; only ChatGPT and Claude have tested selectors today.
- Live provider calls to Anthropic / OpenAI / OpenRouter. The provider layer and its UI are built;
  the transport lands behind the seam described below.
- Account, sign-in, onboarding carousel, refinement history, per-platform model choice.

## Anti-goals

Things that would make this a failure even if it shipped:

- Any prompt text leaving the device without the user having been told, in the UI, where it goes.
- API keys reachable from a content script, or written to `storage.sync`.
- A refinement failure that blocks the user from sending their prompt.
- Intercepting Enter in a way that swallows a send the user intended.

## Decisions

### D1 Toolchain: WXT + Vite, vanilla TypeScript

Settled 2026-11-12. Plasmo was rejected on two checked facts: its last npm release is `0.90.5`
(2025-05-17, ~18 months stale) and it is Parcel-based, which is incompatible with adopting Vite.
WXT's latest is `0.21.5` (2026-10-26) and it is Vite-native. No UI framework; the UI is a few
hundred DOM nodes.

### D2 Design tokens: the design package is authoritative

`docs/design/promptizer-package/PLAN.md` §2.1 wins over `color.css`. Its tokens carry measured
contrast ratios (lowest text pair 6.3:1, control borders ≥3:1); `color.css` is a raw ramp with no
contrast guarantees. The two are already close — the spec's `accent` `#4C8DFF` is within one unit
of `color.css`'s `$v-primary-650` `rgb(77,132,255)` — so this reads as the spec being the finished
derivation of that ramp. `color.css` is retained as the ancestor ramp and as the source for the
future light theme. v1 is dark-only.

### D3 Model order: pinned primary + fallback chain

Chosen from three mockups. The spec's fixed three slots (Primary / Secondary / Fallback, each
emptiable) does not survive the requirement that there be any number of secondaries, so role
labels are generated from position instead of drawn in.

Data model:

```
chain: [ModelRef, ...ModelRef[]]   // non-empty tuple; index 0 is the primary
```

- Exactly one primary, always. It is a separate card with no remove affordance, so the invariant
  holds by construction rather than by a refused delete.
- Any number of fallbacks (0..n), reorderable, each removable.
- A fallback's overflow menu offers "Make primary", which swaps it with index 0.
- Labels come from position: "Always tried first", then "1st fallback", "2nd fallback", ...
- Unavailable entries (key removed, Nano unsupported) keep their position, show a warning status,
  and are skipped at run time.

### D4 Icons: inline the shipped SVGs, no library

The design package ships all 24 icons the asset manifest calls for, at 24×24 / 2px stroke /
`currentColor`. A library would be a runtime dependency for icons already owned, and the spec
requires inlining so they inherit text colour. A build-time inlining helper reads
`assets/icons/*.svg` and emits a typed icon map. `animations/*.svg` already handle
`prefers-reduced-motion` internally.

### D5 Keys live behind the Go backend; the UI talks to a seam

The spec has keys in `chrome.storage.local` with the service worker calling providers directly.
That contradicts the shipped security model (key in the Go service, extension holds a revocable
pairing token) and `docs/scope.md`. Since Go is the backend, keys belong there.

All four screens are built against one `SettingsPort` / `ProviderPort` interface. v1 ships a
`chrome.storage.local` implementation for non-secret settings (chain order, platform toggles,
timeout, global on/off) and routes anything secret through the existing paired local service. No
provider key is ever written to extension storage, and no key ever reaches a content script.
Screen S4 is built in full; its "Save & test" calls the port.

### D6 The popup replaces the options page

Per the spec's explicit exclusion. `options.html` / `options.css` / `options.js` are deleted at the
end of the migration, and `manifest.action.default_popup` replaces `options_page`.

### D7 Font: bundle Inter woff2

Self-hosted, subset to latin. No CDN — a content script fetching a font from the network is both a
latency and a privacy signal. Fallback `system-ui, sans-serif`.

### D8 Trigger stays on the explicit shortcut for v1 (my call, flagged)

The spec's §12 open decision 1 assumes first Enter refines, second Enter sends. Intercepting Enter
inside the ChatGPT and Claude composers is the single riskiest behaviour in the whole spec: if the
interception misfires, it swallows a send the user meant, which is the anti-goal above.

v1 keeps `Command/Ctrl+Shift+Y` as the trigger and ships the chip in all five of its states. The
Enter-to-refine behaviour is built as a SettingRow on S1, "Refine when I press Enter", default
off. This is reversible and does not change any other screen. Flagging it because it is a product
call, not a technical one — say the word and it flips to default on.

## Constraints

- `AGENTS.md`: no comments in code; keep the existing structure where it survives; no third-party
  runtime JS dependencies; ESLint is the only dev dependency; never print or commit `.env`.
  D1 requires amending the dependency rule — WXT's helpers are bundled into shipped code. That
  amendment is step 0 of the plan and is a decision, not a formality.
- `make verify` (go test, race, extension tests, eslint, build) green at every step.
- Popup: 360px fixed width, works to 320px; height 480-580; Chrome caps at 600.
- Minimum hit area 44×44 on every control. Text contrast ≥4.5:1, control borders ≥3:1.
- `minimum_chrome_version: 138`. Loopback-only host permission preserved.
- Motion respects `prefers-reduced-motion`; all SVG animations rest on their final frame.

## Left to the builder

- Component file layout under `components/`, and whether C5/C6/C7/C14 ship as one module or four.
- The exact keyboard-drag announcement strings, beyond the spec's "Moved to position 2, Secondary".
- Test granularity per component, so long as every state in §7's matrix is covered by at least one
  assertion.
- Whether the icon inlining helper is a WXT module or a prebuild script.
