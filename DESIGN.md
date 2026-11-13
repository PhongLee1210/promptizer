# Promptizer UI/UX Design Document

## Overview

Promptizer rewrites a messy prompt into one clean, professional paragraph, keeping the original task and intent. The rewrite is always shown as an editable preview; nothing is ever submitted automatically.

The product has a small surface area on purpose. There is no account, no sync, no telemetry, and no marketing app. All UI lives in one Chrome MV3 extension, backed by a Go CLI and an authenticated `127.0.0.1` service.

Everything below describes a single shared design language: a 10-step color scale system, CSS custom property theming, automatic light/dark adaptation, and a strict consent-first interaction model.

---

## Surfaces

| Surface            | Technology                            | Entry point                       |
| ------------------ | ------------------------------------- | --------------------------------- |
| Content overlay    | Vanilla JS + closed Shadow DOM        | `extension/content.js`            |
| Options page       | Static HTML + CSS                     | `extension/options.html`          |
| Background worker  | MV3 service worker (no UI)            | `extension/background.js`         |
| CLI                | Go, stdin/stdout                      | `cmd/promptrefine`                |

There is deliberately **no browser action popup**. Clicking the toolbar icon opens the options page directly. The refinement UI belongs next to the composer, not in a detached popup.

Host sites: `https://chatgpt.com/*` and `https://claude.ai/*`. Each has an adapter in `extension/adapters/` that locates the composer element; the overlay is adapter-agnostic.

---

## Design System

### Colors

The palette is defined in `color.css` as 10-step scales. Promptizer uses six scales: primary blue, gray, green, red, orange, and a secondary yellow.

| Scale                | Usage                                                        |
| -------------------- | ------------------------------------------------------------ |
| **Primary Blue**     | Brand, primary actions (Replace, Accept, Save), provider badge |
| **Gray**             | Surfaces, borders, body and muted text                        |
| **Green**            | Successful replacement, "Ready on this device", healthy service |
| **Red**              | Errors, failed refinement, rejected insertion                 |
| **Orange**           | Warnings, the privacy boundary notice, focus ring             |
| **Secondary Yellow** | Live-suggestion accent, "opt in" highlights                   |

> **Scale direction.** The gray scale in `color.css` runs **dark to light**: `$v-gray-50` is `rgb(20, 20, 20)` (near black) and `$v-gray-950` is `rgb(250, 250, 250)` (near white). This is the inverse of the Tailwind convention. The chromatic scales run the same way — low steps are deep and saturated, high steps are pale. Read the step number as *lightness*, not *weight*.

Anchor values:

| Token          | Step | Value               |
| -------------- | ---- | ------------------- |
| Primary        | 500  | `rgb(0, 80, 255)`   |
| Primary (dark) | 650  | `rgb(77, 132, 255)` |
| Danger         | 500  | `rgb(221, 34, 34)`  |
| Success        | 500  | `rgb(75, 181, 67)`  |
| Warning        | 500  | `rgb(255, 140, 0)`  |
| Accent         | 400  | `rgb(255, 241, 28)` |

**Change from the current build.** The shipped extension hardcodes a teal primary (`#0f766e`) across `options.css` and the inline shadow-root styles in `content.js`. Adopting `color.css` moves the primary to blue. This is a deliberate rebrand, not a regression, and it must be applied to both surfaces at once so the overlay and options page do not diverge.

### Theming

Themes are applied by emitting CSS custom properties at `:root` (options page) and `:host` (shadow root), then swapping the variable set under `prefers-color-scheme`. Component CSS never references a palette step directly — it only ever reads a semantic token.

| Token              | Light       | Dark        |
| ------------------ | ----------- | ----------- |
| `--pz-primary`     | `$v-primary-500` | `$v-primary-650` |
| `--pz-primary-hover` | `$v-primary-400` | `$v-primary-700` |
| `--pz-on-primary`  | `$v-gray-950` | `$v-gray-50` |
| `--pz-surface`     | `$v-gray-950` | `$v-gray-100` |
| `--pz-surface-sunken` | `$v-gray-900` | `$v-gray-50` |
| `--pz-border`      | `$v-gray-800` | `$v-gray-200` |
| `--pz-text`        | `$v-gray-100` | `$v-gray-900` |
| `--pz-text-muted`  | `$v-gray-350` | `$v-gray-650` |
| `--pz-danger`      | `$v-red-450` | `$v-red-650` |
| `--pz-success`     | `$v-green-450` | `$v-green-650` |
| `--pz-warning`     | `$v-orange-450` | `$v-orange-650` |
| `--pz-accent`      | `$v-secondary-300` | `$v-secondary-500` |
| `--pz-focus-ring`  | `$v-orange-500` | `$v-orange-500` |

The focus ring stays orange in both themes. It is the one token that is intentionally not theme-adaptive, so keyboard focus is unmistakable against either a blue primary button or a gray surface.

Both surfaces declare `color-scheme: light dark` so native controls, scrollbars, and form widgets follow the active theme.

### Typography

- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Promptizer ships no web font — a content script that pulls a font from the network on ChatGPT or Claude would be both slow and a privacy signal.
- Monospace (`ui-monospace, SFMono-Regular, Menlo, monospace`) for `<kbd>` shortcut hints and inline `<code>` in the options page.
- Overlay base size is 14px / 1.5. The options page scales its `h1` with `clamp(28px, 5vw, 40px)`.
- No icon font and no icon sprite. The overlay is text-and-shape only, which keeps the shadow root self-contained.

### Style isolation

The overlay host element uses `all: initial` and attaches a **closed** shadow root. This is load-bearing: ChatGPT and Claude both ship aggressive global CSS, and a leak in either direction breaks the host page or the panel. Rules:

- Never style the overlay from `content.css`. That file positions the host element and nothing else.
- Never rely on a host-page class, variable, or inherited value inside the shadow root.
- `z-index: 2147483647` with `position: fixed`, anchored bottom-right against `env(safe-area-inset-*)`.

---

## Screens & Flows

### 1. Content overlay

Injected into the composer page at `document_idle`. A `MutationObserver` re-checks for the composer on DOM changes and hides the launcher when no composer is present.

**Panel states:**

- **Launcher** — a pill button ("Refine draft"). Visible only when the adapter finds a composer.
- **Context consent** — shown only when visible turns are selected. Offers to include up to two selected turns, names the exact destination ("Gemini Nano on-device" or "Groq"), and defaults to a checked box that the user can clear.
- **Refining** — progress copy plus a Cancel button. States plainly that the original text remains unchanged.
- **Review refinement** (manual) — read-only Original, editable Refined, provider label, and Replace / Copy / Dismiss.
- **Live suggestion** (opt in) — rendered as an `aria-live` region rather than a dialog, with `Tab` to accept and `Esc` to dismiss, plus the same three buttons.
- **Error** — plain-language message, Retry where retrying is meaningful, Dismiss otherwise.

**Primary flow:**

```
Type a draft (8+ characters)
  → Press Command/Ctrl+Shift+Y, or click the launcher
  → (If text is selected) confirm context inclusion
  → Gemini Nano on-device, or Groq fallback
  → Editable preview with provider label
  → Replace, Copy, or Dismiss
```

The draft is fingerprinted before the request. If the composer content changes while a refinement is in flight, or between preview and Replace, the result is discarded and the user is told why. Insertion is verified after writing; if the host editor rejects it, the original is restored and the panel offers Copy instead.

### 2. Options page

A single scrolling column, `min(720px, 100% - 32px)`, grouped into labelled card sections.

**Sections:**

- **AI provider** — provider order (Nano first / Groq only), Groq fallback toggle, "Check or download Gemini Nano" with a live status line, and the download preconditions stated up front.
- **Groq fallback pairing** — pairing token field (`type="password"`), and a read-only, copyable extension origin to pass to the service as `PROMPTREFINE_EXTENSION_ORIGIN`.
- **Behavior** — enable toggle, refinement mode (manual / inline suggestions), and an optional task summary textarea capped at 1200 characters.
- **Privacy boundary** — a persistent orange-bordered aside, not a dismissible banner.

Save is explicit. The status line next to the Save button is an `aria-live` region.

### 3. CLI

Not a visual surface, but it shares the product's rules. Prompts arrive on stdin so they never reach shell history. `--json` and `--context-file` are the only input affordances. `promptrefine pair`, `serve`, and `health` are separate explicit commands — nothing runs as a daemon.

---

## Shared UX Patterns

### Consent before transmission

No text leaves the composer without a user action that names the destination. Selected context is opt-out within an already-explicit trigger, and the destination string is computed from the current provider settings rather than hardcoded.

### Preview, never submit

Promptizer never dispatches a send. The original draft survives every failure path: cancel, stale fingerprint, invalid response, rejected insertion, and empty refinement all leave the composer untouched and say so.

### Provider transparency

Every preview carries a provider label — "Gemini Nano · on-device" or "Groq · cloud fallback". The user should never have to guess where their prompt went.

### Loading

Text-only progress copy with a Cancel button. No spinner, no skeleton. Refinements are short, and an animated loader inside a host page's DOM is a layout and accessibility liability for the value it adds.

### Error handling

Inline, in-panel, in plain language, and always paired with what happened to the draft. Errors distinguish between "retry may help" (network, service, stale draft) and "retry will not help" (no composer, draft too short, already running).

### Empty and ineligible states

The launcher hides rather than showing a disabled control when no composer is found. A draft under 8 characters produces an explanation on manual trigger and silence on live trigger — live mode must never nag.

### Accessibility

These are requirements, not aspirations, and they already hold in the current build:

- 44px minimum interactive target height on every button, input, select, and textarea.
- `outline: 3px solid var(--pz-focus-ring); outline-offset: 2px` on `:focus-visible`, never `outline: none`.
- `aria-live="polite"` status regions for provider status, save confirmation, and refinement results.
- The live suggestion is `role="region"`, not a dialog — it must not steal focus from the composer.
- `Esc` cancels in-flight work and closes the panel from anywhere on the page.
- `prefers-reduced-motion: reduce` disables all transitions.
- `prefers-color-scheme` drives the theme. There is no manual theme toggle; the token layer makes one cheap to add later if needed.

### Keyboard model

| Key                      | Action                                               |
| ------------------------ | ---------------------------------------------------- |
| `Command/Ctrl+Shift+Y`   | Refine the active prompt                             |
| `Tab`                    | Accept a live suggestion (caret at end, no modifiers) |
| `Esc`                    | Cancel the request and dismiss the panel             |

`Tab` acceptance is gated on composer focus, a collapsed caret at the end of the draft, no active IME composition, and no modifier keys. IME composition is tracked via `compositionstart` / `compositionend` so the shortcut never interrupts CJK input.

---

## Localization

The extension UI is **English-only**, and this is a scope decision rather than an oversight. There is no i18n framework, no locale files, and no locale setting.

Language does appear in one place: Gemini Nano currently supports a limited prompt-language set — `en`, `es`, `ja`, `de`, `fr`. `extension/nano.js` detects a likely-unsupported draft language and falls back rather than returning a degraded rewrite. The options page states the supported set in the provider section.

If UI localization is ever added, `chrome.i18n` with `_locales/` is the right mechanism; it needs no bundler support and no runtime dependency.

---

## Migration Plan: Vite + Extension Framework

### Current state

The extension is hand-written MV3 with no build step. Scripts are plain IIFEs attached to `globalThis` (`PromptizerCore`, `PromptizerNano`, `PromptizerProviderRouter`, `PromptizerAdapters`), loaded in dependency order by `manifest.json`. Styles for the overlay live in a template literal inside `content.js`. Verification is `node --check` per file, `node --test` for `extension/tests/`, ESLint, and a `jq` assertion against `manifest.json`.

This works, and its lack of a build step is a genuine feature. What it costs: no HMR, no TypeScript, manual load-order management, no cross-browser output, styles that cannot share a token file with `options.css`, and a palette that has to be duplicated by hand into a JS string.

### Recommendation: WXT

**Use [WXT](https://wxt.dev) with vanilla TypeScript. Do not use Plasmo.**

Two findings decided this, both checked against the npm registry rather than inferred:

1. **Plasmo is effectively stalled.** The latest `plasmo` release on npm is `0.90.5`, published **2025-05-17** — roughly eighteen months ago. For a Manifest V3 extension that depends on a fast-moving Chrome surface (the built-in `LanguageModel` API, which is itself still stabilizing), a build tool that has not shipped in eighteen months is a standing liability.
2. **Plasmo is built on Parcel, not Vite.** "Adopt Vite" and "adopt Plasmo" are mutually exclusive goals. WXT is Vite-native, so one decision satisfies both.

Supporting reasons:

- **Active maintenance.** WXT's latest release is `0.21.5`, published **2026-10-26**.
- **Framework-agnostic.** WXT does not require React. Promptizer's UI is a handful of DOM nodes; a vanilla TypeScript entrypoint keeps `AGENTS.md`'s no-runtime-dependency rule intact in spirit and nearly in letter.
- **`createShadowRootUi` matches the existing architecture.** WXT's content-script UI helper already implements the closed-shadow-root-plus-injected-CSS pattern that `content.js` hand-rolls, including `cssInjectionMode: 'ui'`, which lets the overlay import a real `.css` file instead of a template literal. That single change is what makes a shared token file possible across both surfaces.
- **Generated manifest.** `wxt.config.ts` becomes the single source of truth, and entrypoint discovery removes the hand-maintained content-script load order.
- **Cross-browser for free.** Firefox and Edge targets become a build flag rather than a project.

Alternatives considered and rejected:

| Option | Why not |
| ------ | ------- |
| **Plasmo** | Parcel-based (conflicts with the Vite requirement) and no release since 2025-05-17. |
| **Vite + `@crxjs/vite-plugin`** | The thinnest option and a reasonable fallback. Rejected because it provides no content-script UI helper, no entrypoint discovery, and no cross-browser output — most of what makes the migration worth doing. |
| **Stay hand-written** | Still defensible. The cost is a duplicated palette, a stringly-typed stylesheet, and no path to Firefox. |

### Known tension with AGENTS.md

`AGENTS.md` states: *"No third-party Go or runtime JavaScript dependencies. ESLint is the only dev dependency."*

WXT is a dev dependency, but it is not *only* a dev dependency: helpers such as `createShadowRootUi` and `browser` are imported into shipped code and bundled into the output. This is a real, if narrow, violation of the rule as written.

**Resolve this before writing any migration code.** Amend the rule to something like: *"No third-party runtime dependencies beyond the extension framework's own bundled helpers. No UI framework. No third-party Go dependencies."* Merging that amendment is step 0; it is a decision, not a formality, and it should not be made implicitly by a pull request that happens to add an import.

### Migration steps

Each step should land as its own commit, with `make verify` passing throughout. Nothing here is implemented yet.

**Step 0 — Decide the dependency rule.** Amend `AGENTS.md` as above, or decide against the migration. Everything downstream assumes this is settled.

**Step 1 — Extract the design tokens first, with no build step.** Convert `color.css` from SCSS variables to CSS custom properties, emit the semantic `--pz-*` layer, and consume it from `options.css`. Leave `content.js` alone for now. This is independently valuable, ships the rebrand from teal to blue, and is fully reversible.

**Step 2 — Scaffold WXT alongside the existing extension.** Add `wxt` and `@wxt-dev/module-*` as needed to `devDependencies`, create `wxt.config.ts`, and set `srcDir` so the new tree does not collide with the current `extension/` directory during the transition. Port `manifest.json` into the config's `manifest` key — `permissions`, `host_permissions`, `minimum_chrome_version: 138`, `commands`, and `options_page`.

**Step 3 — Port the background worker.** `extension/background.js` becomes `entrypoints/background.ts` wrapped in `defineBackground`. Its `main` cannot be async; the existing listener-registration shape already satisfies this. Convert the module's exports from `globalThis` assignment to real ES imports.

**Step 4 — Port the shared modules.** `core.js`, `nano.js`, and `provider-router.js` move to `utils/` as ES modules. Delete the IIFE wrappers and the `globalThis` registration. These three files have the project's test coverage, so port them with their tests and keep `node --test` green at each move. Add types incrementally — `nano.ts` benefits most, since Chrome's `LanguageModel` API surface is where silent shape mismatches hide.

**Step 5 — Port the adapters.** `adapters/chatgpt.js` and `adapters/claude.js` become modules exporting a typed `Adapter` interface. Replace the `PromptizerAdapters` global array with an explicit import list.

**Step 6 — Port the content script and move the styles out of JavaScript.** `entrypoints/content.ts` using `defineContentScript` with `matches`, `runAt: 'document_idle'`, and `cssInjectionMode: 'ui'`. Replace `ensureRoot()` with `createShadowRootUi`, and replace the `styles()` template literal with an imported `overlay.css` that reads the same `--pz-*` tokens as the options page. This step is the point of the migration; schedule it when there is time to test both host sites by hand against `docs/manual-test.md`.

**Step 7 — Port the options page.** `entrypoints/options/index.html` plus `options.ts` and `options.css`. Mostly a move.

**Step 8 — Rewire the build and verification.** Replace `node --check` in the `test-js` target with `wxt prepare` and `tsc --noEmit`. Point the `jq` manifest assertion at the generated `.output/chrome-mv3/manifest.json` so the existing invariants — MV3, Chrome 138+, loopback-only host permission, no `offscreen` permission — are still enforced, now against the artifact that actually ships. Update ESLint for TypeScript. Add `.output/` and `.wxt/` to `.gitignore`.

**Step 9 — Update the docs and remove the old tree.** Rewrite the "Use the extension" section of `README.md` for the new unpacked-load path (`.output/chrome-mv3`), add `npm run dev` to the commands list, and delete `extension/` only once `make verify` and a full manual pass both succeed.

**Step 10 — Optional, after the migration settles.** Add a Firefox target and run `wxt zip` for store submission. Do not bundle this into the migration; it is a separate decision with its own review surface.

### Risks

- **Step 6 is the risky one.** `writeEditor` depends on prototype value setters, `execCommand('insertText')`, and synthetic `InputEvent` dispatch against two third-party editors. Bundling changes module scope and evaluation order. Port it last, change its logic in no way, and verify against both host sites before merging.
- **Closed shadow root.** `createShadowRootUi` must be configured to preserve `mode: 'closed'`. Verify this rather than assuming it; an open root is a behavior change on pages running untrusted scripts.
- **Content-script CSP.** ChatGPT and Claude both ship strict policies. Confirm WXT's dev-mode injection works on both before committing to the HMR workflow; if it does not, develop against a local fixture and verify on the real sites with production builds.
- **Bundle growth.** The current content script is small. Check the output size after step 6 and treat a large increase as a finding, not a cost of doing business.
