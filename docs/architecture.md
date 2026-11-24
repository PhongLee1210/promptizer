# Architecture

Promptizer is a Chrome extension with two moving parts and no server. A **content script** lives on
the page you are typing on; a **popup** is the settings surface. There is no background worker, no
backend, and no third-party runtime code. Nothing ever leaves the machine.

## The whole system

```
 ┌─ the page you're typing on ───────────────────────────────┐
 │                                                           │
 │   your text field                                         │
 │        │ you focus it                                     │
 │        ▼                                                  │
 │   is this prose?  ──no──► do nothing, ever                │
 │        │ yes                                              │
 │        ▼                                                  │
 │   show the chip ──click──► action rail ──pick──► run it   │
 │                                                  │        │
 │                                                  ▼        │
 │                                    Gemini Nano, on-device │
 │                                                  │        │
 │                                                  ▼        │
 │                                    editable preview       │
 │                                      │                    │
 │                              Replace │ Dismiss            │
 │                                      ▼                    │
 │                              your text field              │
 └───────────────────────────────────────────────────────────┘
                            ▲
                            │ one shared on/off switch
                            ▼
 ┌─ the popup ───────────────────────────────────────────────┐
 │   on/off · model status · setup guide · site and model    │
 │   preferences                                             │
 └───────────────────────────────────────────────────────────┘
```

Everything the extension can do flows down that single path. There is no second route, no queue, no
sync, no remote call.

## Four ideas worth knowing

### 1. The chip is sealed off from the page

The chip renders into a closed shadow root at the top of the stacking order. Page CSS cannot restyle
it and page scripts cannot read it. That is also why the extension can live on every site without
breaking any of them.

Placement is recomputed on scroll, resize and whenever the field changes size, so the chip stays
inside the field's padding box rather than floating next to it. If the page tears the editor out of
the DOM mid-run, the chip notices and stands down.

### 2. Prose fields only, decided before anything is read

A field earns a chip only if it looks like prose. Anything that smells like a password, a one-time
code, a card number, a username, an email, a phone number or a short bounded input is skipped — judged
from its role, input mode, autocomplete hints, length limit and surrounding label text.

This runs *before* any text is read, so sensitive values never enter the extension at all. Privacy here
is a structural property, not a promise.

### 3. One state machine drives the UI

Everything on screen is one of a handful of views, and every transition is a pure function of the
current view plus an event:

```
closed ──click chip──► rail ──pick action──► loading ──┬─► preview ──┬─► inline edit
   ▲                     ▲                      │       │            └─► tweak
   │                     │                      │       └─► history: step / delete
   │                  cancel                downloading                
   │                     │                   the model                 
   │                     └────────────────────┘ │                      
   └── dismiss / field left ◄─── error ──retry──┘                      
```

Two consequences fall out of this. **Cancelling always lands somewhere sensible** — pressing `Esc`
mid-run returns you to the rail, not to a dead end. And **a missing model is a detour, not a failure**:
the first request discovers Gemini Nano is not downloaded, the chip turns into a progress ring, and the
same request is retried automatically once the download finishes.

Late results cannot corrupt the UI. Each run is stamped with a counter that is bumped by every focus
change, dismissal or cancellation, so a slow answer that arrives after you have moved on is discarded
instead of rendered.

### 4. The model is asked carefully and never trusted blindly

Each action sends its own instruction — refine, shorten, translate, change tone — plus a set of shared
rules: keep names, scope and constraints, do not answer the prompt, do not invent requirements.

The model is constrained to return a small JSON object, and the answer is rejected if it comes back
with line breaks, as a bulleted list or heading, or over the size limit. A rejected answer surfaces as
an error with your text untouched, which is always preferable to pasting something malformed into your
editor.

Sessions are reused across runs so the instruction prefill is paid once rather than per click, and each
run gets an isolated copy, so nothing you typed earlier leaks into a later rewrite.

## Writing text back

Replacing text in a modern web editor is the hardest part of the extension. React, Lexical and
ProseMirror all track their own copy of the content and will happily overwrite a naive write on the
next render.

So the write is attempted from the most cooperative strategy to the least:

1. Ask the browser's own text-insertion command to do it, and verify it actually took.
2. Failing that, announce the replacement as an editing event and let the framework apply it.
3. Only if nothing responds does the extension set the text directly and restore the caret.

Either way, an input event is dispatched so the host page knows its value changed. Every replacement
is also stashed for six seconds, which is what the undo button on the chip restores.

## Preview, never submit

The rewrite always lands in an editable preview. You can copy it, edit it inline, run another action
on top of it, regenerate it, or step back through the last ten results — all before anything touches
your field, and only on an explicit **Replace**. The extension never presses send.

Result history is per page session and in memory only. Reloading the tab clears it.

## Settings and what they actually control

The popup and the content script share exactly one piece of state: **the global on/off switch**.
Turning Promptizer off from the chip updates the popup, and vice versa, live, in every open tab.

Everything else in the popup — site list, model slots, provider keys, suggestion settings — is stored
but not yet read at runtime. It is finished UI over an unfinished path. Specifically:

| Surface                    | Status                                                            |
| -------------------------- | ----------------------------------------------------------------- |
| Global on/off              | Working, both directions.                                         |
| Gemini Nano setup guide    | Working, including the on-demand download.                        |
| Cloud providers and keys   | UI only — every action goes to Gemini Nano. Key checking is a stub. API keys are not stored. |
| Model order and backups    | UI only — there is no fallback chain yet.                         |
| Per-site toggles           | UI only — the chip appears on every site regardless.              |
| Suggestion settings        | UI only — nothing reads them.                                     |
| Keyboard shortcut          | Declared in the manifest but has no handler. Use the chip.        |

The popup paints from a warm local cache before its stored state resolves, so it never flashes empty.

## Translating selected text

Behind the build-time flag `WXT_FEATURE_TRANSLATE_ON_PAGE`, three content modules add on-page
translation: `translator.ts` wraps the browser's Translator and LanguageDetector APIs,
`translate-bubble.ts` draws the button and the bubble in a closed shadow root, and
`selection-translate.ts` listens for selections and wires the two together. The entrypoint loads them
with a dynamic `import()` inside the flag check, so a disabled build does not contain them.

They live in the content script because those APIs are not available in workers; there is no
background entrypoint to host them anyway. Creating a translator requires user activation, so it
happens inside the button's click handler and is never prewarmed on page load. The chip and the
translate button never share a target: the chip owns editable fields, translation owns the rest.

## Guardrails

Several invariants are enforced by the build rather than by review:

- The shipped manifest is asserted on every build and release: Manifest V3, Chrome 138 minimum, no
  broad host permissions, no offscreen documents. Permissions are storage and active-tab only.
- Every colour, elevation and radius goes through a design token; check this during review.
- A small Puppeteer E2E suite exercises user journeys against a real unpacked build with a stubbed
  model, so it stays deterministic and offline. Real on-device model behavior needs a manual smoke test.
- Releases are tag-driven, and a tag that does not match the declared version fails the build.

For what the extension does from a user's point of view — the nine actions, the journeys, the field
rules in detail — see [features.md](features.md).
