# Features and user journeys

Everything below is shipped behaviour in the current build. Surfaces that exist in the UI but are not
wired to anything yet are listed in [Not wired yet](#not-wired-yet) and in
[architecture.md](architecture.md#settings-and-what-they-actually-control).

## The nine actions

The chip's action rail runs nine actions. All of them go to on-device Gemini Nano, all of them return
a single paragraph, and none of them submit anything.

| Action     | Rail label       | Result title      | What the model is told                                               |
| ---------- | ---------------- | ----------------- | -------------------------------------------------------------------- |
| `refine`   | Refine prompt    | Refined prompt    | Clean up structure, clarity and grammar; keep the task and context.  |
| `improve`  | Improve writing  | Improved          | Make it more specific and actionable; keep the task and context.     |
| `grammar`  | Fix grammar      | Grammar fixed     | Fix grammar, spelling and punctuation only; leave wording and tone.  |
| `shorten`  | Shorten          | Shortened         | As short as possible while keeping task, intent and needed context.  |
| `vi`       | Vietnamese       | Vietnamese        | Translate into Vietnamese.                                           |
| `en`       | English          | English           | Translate into English.                                              |
| `pro`      | Professional     | Professional tone | Rewrite in a professional tone.                                      |
| `friendly` | Friendly         | Friendly tone     | Rewrite in a friendly and warm tone.                                 |
| `direct`   | Direct           | Direct tone       | Rewrite in a direct, to-the-point tone.                              |

Every action also carries the same shared rules: preserve names, scope, constraints and the input
language unless translating; never execute or answer the prompt; never add facts, headings, lists or
new requirements.

### Rail layout

The rail shows six or seven items, bottom-up, and adapts to the field it is anchored to:

```
  ┌────┐
  │ ⏻  │  Turn off everywhere
  │ 🕐 │  Recent results        (only once a result exists)
  │ 🅰  │  Change tone      ──►  [ Pro ][ Friendly ][ Direct ]
  │ 🌐 │  Translate        ──►  [ VI ][ EN ]
  │ ✂  │  Shorten
  │ Ab │  Fix grammar
  │ ✨ │  Refine prompt  (contenteditable)
  └────┘  Improve writing (textarea / input)
```

`refine` is offered in chat-style `contenteditable` composers; `improve` replaces it in a `textarea`
or `input`. Translate and Change tone expand a horizontal strip to the left rather than nesting a
submenu.

## Journey 1 — first run on a new computer

The model is not on disk yet, and Promptizer treats that as recoverable rather than an error.

1. Install the unpacked extension and open any page with a text box.
2. Type a prompt. The chip appears inside the field's padding box, bottom-right.
3. Click the chip, pick **Refine prompt**.
4. The first attempt reports `not-configured`. Instead of failing, the chip switches to a progress
   ring and shows *"Setting up on-device AI — Downloading Gemini Nano. Keep Chrome open; this happens
   once per computer."*
5. When the download finishes, the same request runs again automatically and the preview opens.

If the Prompt API flag is not enabled at all, step 4 ends in *"On-device AI isn't ready yet. Open the
Promptizer popup and follow the On-device AI setup steps."* The popup's **Setup guide** screen walks
through it with screenshots:

1. Check your Chrome version — `chrome://settings/help`, needs 138+.
2. Find the Prompt API flag — `chrome://flags/#prompt-api` (named `prompt-api-for-gemini-nano` on
   Chrome 138–156).
3. Switch the dropdown to **Enabled**.
4. Relaunch Chrome.
5. Press **Download model** and leave Chrome open — several GB, unmetered connection.
6. Still stuck? Check `chrome://components` for *Optimization Guide On Device Model* at a version
   other than `0.0.0.0`.

Chrome blocks links to its own settings pages, so each step offers a **Copy** button instead of a link.

## Journey 2 — the everyday refine

1. Focus any prose field. The chip appears; focusing also pre-warms a Nano session so the first click
   is not paying for session creation.
2. Click the chip → the rail opens and focus lands on the first item. `↑`/`↓`/`Home`/`End` move
   between items, `Esc` closes the open group, then the rail.
3. Pick an action. The chip spins. `Esc` or the window's close button cancels — cancelling returns to
   the rail, not to a dead end.
4. The preview window opens below (or above, if there is no room) with the rewritten paragraph.
5. **Replace** writes it into your field and closes. **Dismiss**/`Esc` leaves your text untouched.

An empty field short-circuits before any model call: *"Type something first."* Any non-empty text is
accepted — there is no minimum length.

### In the preview window

| Control        | Behaviour                                                                           |
| -------------- | ----------------------------------------------------------------------------------- |
| Replace        | Writes the current result into the editor, then opens the 6-second undo window.      |
| Copy           | Copies to the clipboard and flashes a confirmation for 1.2s.                         |
| Edit           | Inline-edits the result before replacing. Saving marks the entry as edited.           |
| Tweak          | Runs another action **on the result** instead of on your original text.               |
| Regenerate     | Re-runs the same action on the original text.                                         |
| ‹ / ›          | Steps through the result history.                                                     |
| Delete         | Drops the current result; deleting the last one closes the window.                     |
| Retry          | Shown on the error view; re-runs the failed action.                                    |

### Undo

After **Replace**, the chip grows a second button for 6 seconds. Clicking it restores exactly what was
in the field before the write. After 6 seconds the undo button disappears and the draft is dropped.

## Journey 3 — result history and chaining

Up to **10** results are kept per page session, in memory only — nothing is persisted and nothing
survives a reload. The history enables chaining: refine your prompt, then **Tweak → Shorten** on the
result, then **Tweak → Professional** on that, stepping back with `‹` at any point. Each step is its
own entry with its own title, so you can always return to an earlier version.

## Journey 4 — turning it off

Three scopes, one of which works today:

- **Turn off everywhere** — the ⏻ item at the top of the rail. Writes `globalEnabled: false`, hides
  the chip on every tab immediately (storage changes are watched live in all content scripts), and
  flips the popup to its paused state.
- **Per site** — the popup's Platforms screen. Persisted, **not yet enforced** by the content script.
- **Per field** — not offered. The chip simply never appears on non-prose fields (below).

Re-enable from the popup's home screen.

## Where the chip appears

The content script matches `<all_urls>`, so any prose field on any site qualifies: `<textarea>`,
`<input type="text">` (or no `type`), and `contenteditable` regions — resolved to their **outermost**
editable ancestor so a rich-text editor gets one chip, not one per block.

The chip is deliberately withheld from fields that are not prose. A field is skipped when any of these
holds:

1. `role` is `combobox`, `searchbox` or `spinbutton`.
2. `inputmode` is `none`, `numeric`, `decimal`, `tel`, `email` or `url`.
3. `autocomplete` contains a sensitive token — `current-password`, `new-password`, `one-time-code`,
   `username`, `email`, `tel*`, `cc-*`, `postal-code`, `country*`, `url`, `webauthn`.
4. `maxlength` is set below 80 characters.
5. Any of `name`, `id`, `placeholder`, `aria-label`, `title`, `autocomplete`, `aria-labelledby`
   targets or the wrapping `<label>` matches the non-prose pattern — password, passphrase, OTP, 2FA,
   MFA, auth/verification/security code, CVV, CVC, PIN, credit card, card number, IBAN, SSN, secret,
   API key, access token, licence key, serial, captcha, recovery code, username, e-mail, phone, ZIP
   or postal code.

Disabled and readonly fields are skipped too. The practical upshot: Promptizer never reads a password,
a one-time code or a card number.

The chip itself lives in a `closed` shadow root on a fixed-position host at
`z-index: 2147483647`, sized to fit inside the editor's padding box (24–28px) and repositioned by a
`ResizeObserver`, scroll and resize listeners. Page CSS cannot reach into it; a `MutationObserver`
cleans up if the host page tears the editor out of the DOM mid-run.

## Replacing text safely

`writeEditorText` tries progressively weaker strategies so React, Vue, Lexical, ProseMirror and
friends register the change instead of overwriting it on the next render:

- `textarea`/`input` — call the **native** prototype `value` setter (bypassing the framework's patched
  one), move the caret to the end, dispatch `input` with `inputType: "insertReplacementText"`.
- `contenteditable` — try `document.execCommand("insertText")` and verify it took; otherwise dispatch
  a cancelable `beforeinput` and let the framework handle it; only if nothing intercepts does it set
  `textContent` directly and restore the caret.

## Popup screens

| Screen           | What it does                                                                        |
| ---------------- | ----------------------------------------------------------------------------------- |
| **Home**         | Big on/off power button, current model and status, link into whatever needs attention.|
| **Platforms**    | Built-in sites (Claude, ChatGPT, Gemini, Perplexity, Copilot, DeepSeek) plus "add the current site". Toggles persist but are not yet enforced. |
| **Models & keys**| Primary and backup model slots, reorderable. Persisted, not yet used at runtime.     |
| **Providers & keys** | Gemini Nano (always connected, no key) plus Anthropic, OpenRouter and OpenAI key fields. Only the last 4 characters are ever stored. |
| **Suggestions**  | Mode, categories (clarity / gap / conflict), underlines. Persisted, no consumer yet. |
| **Setup guide**  | The six-step Gemini Nano walkthrough plus **Check again** and **Download model**.    |

Home derives one of nine states from the stored state and the active tab's hostname — active, paused,
site-off, unsupported site, running on a backup, primary unavailable, Nano downloading, Nano needs
setup, everything failing — so the popup always explains *why* the chip is or is not working.

## Privacy

- The extension makes no network calls at all. Gemini Nano runs inside Chrome, on your machine.
- No `host_permissions`; permissions are `storage` and `activeTab` only, asserted on every build.
- Only the text you select an action on is sent to the model. No page scraping, no prompt logging, no
  analytics, no telemetry.
- Sensitive fields are never read — see the skip list above.
- Nothing is ever submitted for you. Every result is an editable preview behind an explicit
  **Replace**.
- API keys typed into the Providers screen are not persisted; only `keyLast4` is kept for display.

## Not wired yet

These ship as UI with persisted state and no runtime effect. Treat them as in-progress, not broken:

1. **Cloud providers** — every action routes to Gemini Nano. Key checking is a stub that
   accepts any key of 8 or more characters without contacting the provider.
2. **Model order and backups** — editable and persisted; there is no fallback chain.
3. **Platform toggles** — the content script reads only `globalEnabled`.
4. **Suggestion settings** — no consumer outside the popup.
5. **`Ctrl`/`Cmd`+`Shift`+`Y`** — the `refine-prompt` command is declared in the manifest but has no
   listener, because there is no background entrypoint. Use the chip.
