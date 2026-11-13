# Promptizer extension popup: implementation plan

Scope: the toolbar popup (4 screens and their states) plus the in-page chip it controls.
Matches the design canvas "Promptizer extension UX".

Contents

1. Principles and screen map
2. Design tokens (color, type, spacing, motion)
3. Reusable components
4. Screens, wireframes and states
5. In-page chip (context for the popup's states)
6. UX journeys
7. State matrix (loading, success, empty, unavailable, error)
8. Interaction patterns
9. Responsive behavior
10. Accessibility checklist
11. Asset manifest
12. Open decisions

---

## 1. Principles and screen map

- One primary action per screen. The main screen's is the power button.
- Works with zero setup: Gemini Nano is primary, no key needed.
- Status is always visible in plain words: which model is working, and whether text leaves the device.
- Failure never blocks sending. Worst case, the original prompt goes out unchanged.
- No screen exists unless a primary intent needs it. Four screens total, two levels deep at most.

```
Toolbar icon
   |
   v
[S1 Main] ----------------> [S2 Platforms]
   |
   +----------------------> [S3 Models & keys] ---> [S4 Providers & API keys]
```

Back always returns one level. Closing and reopening the popup always lands on S1.

Things deliberately left out: account/sign-in, onboarding carousel, refinement "style" presets,
history, per-platform model choice, a separate options page.

---

## 2. Design tokens

### 2.1 Color (dark theme, default)

Contrast figures are measured against the background listed.

| Token              | Hex       | Use                                         | Contrast            |
|--------------------|-----------|---------------------------------------------|---------------------|
| `bg`               | `#14161A` | Popup background                            |                     |
| `surface`          | `#1B1E24` | Cards, grouped rows                         |                     |
| `surface-inset`    | `#101216` | Text inputs                                 |                     |
| `divider`          | `#23262D` | Row separators (decorative only)            |                     |
| `border-control`   | `#6E7582` | Input, outline-button, dashed-slot borders  | 3.9:1 on bg, 3.6:1 on surface |
| `track-off`        | `#3A3F48` | Toggle track when off, progress track       | knob carries contrast |
| `text`             | `#E8EAED` | Primary text                                | 15.0:1 on bg        |
| `text-2`           | `#B4BAC4` | Status text, values                         | 9.3:1 bg, 8.6:1 surface |
| `text-3`           | `#9AA0AA` | Helper text, labels                         | 6.9:1 bg, 6.3:1 surface |
| `accent`           | `#4C8DFF` | On state, focus ring, primary button        | 5.7:1 on bg         |
| `on-accent`        | `#0B1220` | Text on accent                              | 5.8:1               |
| `accent-tint`      | `#1B2233` | Power button fill when on, refining chip    |                     |
| `success`          | `#3FCF8E` | Ready/connected dot                         | 8.4:1 on surface    |
| `success-text`/`-bg` | `#7FE0B3` / `#16291F` | Success chip                    | 9.6:1               |
| `warning`/`-bg`    | `#F5C469` / `#2A2415` | Backup in use, downloading          | 9.5:1               |
| `danger`/`-bg`     | `#FF8A80` / `#2E1A1A` | Errors, destructive confirm         | 7.2:1               |

Rules

- Status is never color alone. Each status has a dot shape and a word:
  filled dot = ready/in use, hollow dot = standing by, triangle = attention, circle-! = error.
- Accent means "on" or "primary action" only. Do not use it for decoration.
- Tokens are semantic, so a light theme is a second value set, not a redesign. Not in scope for v1.

### 2.2 Typography

Font: Inter (bundle the woff2; do not load from a CDN in an extension), fallback `system-ui, sans-serif`.

| Style     | Size / line | Weight | Use                                   |
|-----------|-------------|--------|---------------------------------------|
| `title`   | 16 / 22     | 600    | Hero status line on S1                |
| `header`  | 15 / 20     | 600    | Screen title, product name            |
| `body-strong` | 14 / 20 | 600    | Model names                           |
| `body`    | 13 / 18     | 400-500| Row labels, buttons, inputs           |
| `caption` | 12 / 16     | 400    | Status, values, helper text           |
| `overline`| 11 / 14     | 600, +0.06em, uppercase | Section labels      |
| `micro`   | 11 / 15     | 400    | Sub-labels (domain, key ending), footer |

Minimum size is 11px. Numbers use tabular figures where they change live (download %).

### 2.3 Spacing, radius, size

- Base unit 4px. Scale: 4, 8, 12, 16, 24.
- Popup padding: 16 horizontal. Gap between groups: 12. Hero top padding: 24.
- Radius: 8 (inputs, small buttons), 10 (cards, rows), 14 (chips), full (toggle, power button).
- Row heights: 48 (nav/setting row), 56 (two-line row), 52 (header).
- Minimum hit area 44x44 for every control, even when the visible part is smaller (toggle is 36x20 inside a 44x44 button).

### 2.4 Motion

| Motion               | Duration / easing        | Asset                         |
|----------------------|--------------------------|-------------------------------|
| Toggle knob          | 120ms ease-out           | CSS only                      |
| Screen push / pop    | 160ms ease-out, 16px slide + fade | CSS only             |
| Power on             | 1.4s ring, once          | `animations/power-pulse.svg`  |
| Working (determinate unknown) | 1.2s loop       | `animations/progress-indeterminate.svg` |
| Spinner (buttons)    | 0.8s loop                | `animations/spinner.svg`      |
| Refining (chip)      | 1.2s loop                | `animations/refining.svg`     |
| Success              | 0.45s, once              | `animations/success-check.svg`|

All SVG animations stop under `prefers-reduced-motion: reduce` and rest on their final frame.
Apply the same media query to the CSS transitions (set durations to 0).

---

## 3. Reusable components

| ID  | Component        | Anatomy                                                   | States                                    |
|-----|------------------|-----------------------------------------------------------|-------------------------------------------|
| C1  | Header (main)    | logo 22 + name, right: StatusPill                         |                                           |
| C2  | Header (sub)     | back button 44x44 + title, optional right count           |                                           |
| C3  | StatusPill       | glyph + one or two words                                  | Active, Paused, Using backup, Not on this site, Needs attention |
| C4  | PowerButton      | 124px circle (104 in compact), icon 30 + "On"/"Off"       | on, off, focus, pressed, disabled (unsupported site) |
| C5  | Toggle           | `button[role=switch]`, 36x20 track, 16 knob               | on, off, disabled, focus                  |
| C6  | NavRow           | label, right value + chevron, whole row is the link       | default, hover, focus                     |
| C7  | SettingRow       | label (+ sub-label), right control                        | default, disabled                         |
| C8  | ModelCard        | overline "Model", StatusDot + name, status, fallback line | ready, standing by, backup in use, downloading, error |
| C9  | ModelSlot        | drag handle, role label, model name, status line, change chevron | filled, active (accent border), empty (dashed), unavailable, dragging |
| C10 | ModelPicker      | inline list under a slot, grouped by provider             | open, option selected, option disabled (no key) |
| C11 | ProviderRow      | name, sub-label, StatusDot + word, overflow button        | built-in, connected, not connected, error |
| C12 | KeyField         | label, password input, show/hide, primary button, helper  | empty, filled, testing, success, error    |
| C13 | Banner           | tinted box, one sentence, optional action                 | warning, danger, info                     |
| C14 | Button           | primary (accent), outline, text, dashed-add               | default, hover, focus, pressed, loading, disabled |
| C15 | StatusDot        | 8px                                                       | filled success, hollow neutral, hollow warning |
| C16 | EmptyState       | illustration 160x120, one line, one action                |                                           |
| C17 | FooterNote       | one centered micro line                                   |                                           |
| C18 | Chip (in-page)   | 28px pill, glyph + text, optional text button             | idle, refining, refined, refined-by-backup, failed |

Build C5, C6, C7, C14 first; every screen is composed from them.

---

## 4. Screens, wireframes and states

Popup width is 360px. Wireframes are 44 columns wide; `(o )` is a toggle off, `( o)` on.

### S1 Main

Purpose: turn refinement on or off, see which model is working, reach settings.

```
+------------------------------------------+
| [logo] Promptizer            (*) Active  |  C1 + C3            52
+------------------------------------------+
|                                          |
|                .--------.                |
|               /   (|)    \               |  C4 PowerButton    124
|               \    On    /               |
|                '--------'                |
|                                          |
|           Refining your prompts          |  title
|   Press Enter to refine, again to send   |  caption
|                                          |
| +--------------------------------------+ |
| | Refine on claude.ai             ( o) | |  C7 + C5            48
| +--------------------------------------+ |
| +--------------------------------------+ |
| | MODEL                                | |  C8 ModelCard
| | (*) Gemini Nano     On-device, Ready | |
| | If it fails: Claude Haiku, then ...  | |
| +--------------------------------------+ |
|  Platforms                  5 of 6 on  > |  C6                 48
|  ----------------------------------------|
|  Models & keys     2 providers conn.   > |  C6                 48
|                                          |
|  On-device refinement never leaves ...   |  C17
+------------------------------------------+
```

Hierarchy: power button, then the status sentence, then the site switch, then the model card. Settings links are last.

States

| State | Trigger | What changes |
|-------|---------|--------------|
| 1a On | global on, site supported and enabled, primary ready | As drawn. Pill "Active". |
| 1b Paused | global off | Button grey "Off". Title "Refinement is paused", caption "Your prompts are sent exactly as you type them". Site toggle shown but disabled. Dots hollow, status "Standing by". Footer "Your settings are kept while paused." Toolbar icon `toolbar-off`. |
| 1c Site switched off | global on, this site's toggle off | Button stays on. Title "Off for claude.ai". Caption "Still on for your other platforms". |
| 1d Unsupported site | tab is not a known platform | Site row replaced by: "No chat box found on this site" + outline button "Add this site". Pill "Not on this site". Power button still works (it is global). |
| 1e Backup in use | primary unavailable or downloading, a backup is ready | Compact button (104). Pill "Using backup" with triangle. Model card expands to list all three slots with their status; downloading shows % and a progress bar. Warning banner: "While a cloud model is in use, your prompt text is sent to {provider}." Toolbar icon `toolbar-backup`. |
| 1f Primary unavailable, no backup | Nano unsupported on this device and no keys | Pill "Needs attention". Model card shows `nano-unavailable` glyph line "Gemini Nano isn't available on this computer" + primary button "Add a backup model" (goes to S4). Power button stays on but title reads "Can't refine yet". |
| 1g All models failing | last attempt exhausted the order | Pill "Needs attention". Danger banner "Couldn't reach any model. Prompts are being sent unchanged." + text button "Check models". Toolbar icon `toolbar-error`. Clears on next success. |
| 1h First open | fresh install | Same as 1a. No onboarding; the caption line is the instruction. |

Loading: the popup reads from local storage and renders in one frame. No skeleton. Model status that
needs a live check renders its last known value first, then updates.

1e wireframe (the only S1 state with a different layout):

```
+------------------------------------------+
| [logo] Promptizer        /!\ Using backup|
+------------------------------------------+
|               .------.                   |
|              (  (|)   )                  |  C4 compact        104
|               '------'                   |
|       Refining with a backup model       |
|  Nothing for you to do. It switches back |
| +--------------------------------------+ |
| | MODEL                                | |
| | ( ) 1 Gemini Nano   Downloading 42%  | |
| | [=========...................]       | |
| | (*) 2 Claude Haiku  Cloud, in use    | |
| | ( ) 3 OpenRouter    Cloud, standing  | |
| | +----------------------------------+ | |
| | | /!\ Prompt text is sent to       | | |  C13 warning
| | |     Anthropic while in use.      | | |
| | +----------------------------------+ | |
| +--------------------------------------+ |
|  Platforms                  5 of 6 on  > |
|  Models & keys     2 providers conn.   > |
+------------------------------------------+
```

### S2 Platforms

Purpose: choose which AI sites Promptizer works on.

```
+------------------------------------------+
| <  Platforms                  5 of 6 on  |  C2                 52
+------------------------------------------+
|  Promptizer refines inside the message   |  caption
|  box on the sites you switch on.         |
|                                          |
|  [C ] Claude                       ( o)  |  C7 two-line        56
|       claude.ai                          |
|  ----------------------------------------|
|  [Ch] ChatGPT                      ( o)  |
|       chatgpt.com                        |
|  ----------------------------------------|
|  [G ] Gemini                       ( o)  |
|       gemini.google.com                  |
|  ----------------------------------------|
|  [P ] Perplexity                   ( o)  |
|       perplexity.ai                      |
|  ----------------------------------------|
|  [Co] Copilot                      ( o)  |
|       copilot.microsoft.com              |
|  ----------------------------------------|
|  [D ] DeepSeek                     (o )  |
|       chat.deepseek.com                  |
|                                          |
| + - - - - - - - - - - - - - - - - - - -+ |
| :      +  Add the site in this tab     : |  C14 dashed-add     44
| + - - - - - - - - - - - - - - - - - - -+ |
+------------------------------------------+
```

Platform tiles are neutral monograms, not third-party logos (avoids trademark and asset upkeep).

States

| State | Trigger | What changes |
|-------|---------|--------------|
| 2a Default | | As drawn. The current tab's platform is listed first. |
| 2b All off (empty) | every toggle off | List stays. Above it, C16 with `platforms-empty.svg`: "No platforms are on, so nothing is refined." + text button "Turn all on". S1 pill reads "Paused". |
| 2c Add site, available | tab has a text box Promptizer can attach to | Button enabled. On click: row appears at the top, toggled on, with a brief `success-check`. Chrome may show its own permission prompt first. |
| 2d Add site, unavailable | tab is a known platform, a browser page, or has no text box | Button disabled, text "This tab can't be added". |
| 2e Add site, permission denied | user declines the browser prompt | Info banner "Promptizer needs permission for this site to work on it." + "Try again". No row is added. |
| 2f Custom row | user-added site | Row has an overflow menu with "Remove". Built-in rows cannot be removed, only switched off. |
| 2g Many rows | more than 6 | List region scrolls; header and add button stay fixed. |

### S3 Models & keys

Purpose: set the order models are tried in.

```
+------------------------------------------+
| <  Models & keys                         |  C2
+------------------------------------------+
|  MODEL ORDER                             |  overline
|  Tried from top to bottom. Drag to       |  caption
|  reorder.                                |
| +======================================+ |
| | :: Primary                         v | |  C9 active (accent border)
| |    Gemini Nano                       | |
| |    (*) On-device, Ready, no key      | |
| +======================================+ |
| +--------------------------------------+ |
| | :: Secondary                       v | |  C9
| |    Claude Haiku                      | |
| |    (*) Anthropic, key connected      | |
| +--------------------------------------+ |
| +--------------------------------------+ |
| | :: Fallback                        v | |  C9
| |    OpenRouter Auto                   | |
| |    (*) OpenRouter, key connected     | |
| +--------------------------------------+ |
|                                          |
|  Move to the next model after [ 5 s v ]  |  C7 + select        48
|  ----------------------------------------|
|  Providers & API keys     2 connected  > |  C6                 48
|                                          |
|  If every model fails, your prompt is    |  C17
|  sent unchanged.                         |
+------------------------------------------+
```

The role (Primary, Secondary, Fallback) belongs to the position, not the model. Reordering changes
which model has which role; the labels stay put.

Model picker (C10), opens inline under the slot whose chevron was pressed. Not a new screen:

```
| +--------------------------------------+ |
| | :: Secondary                       ^ | |
| |    Claude Haiku                      | |
| +--------------------------------------+ |
| | ON THIS DEVICE                       | |
| |   Gemini Nano            in use as 1 | |  disabled: already assigned
| | ANTHROPIC                            | |
| | * Claude Haiku                       | |  selected
| |   Claude Sonnet                      | |
| | OPENROUTER                           | |
| |   Auto                   in use as 3 | |
| | OPENAI                               | |
| |   Add a key to use these           > | |  goes to S4, OpenAI expanded
| | ------------------------------------ | |
| |   Leave this slot empty              | |
| +--------------------------------------+ |
```

States

| State | Trigger | What changes |
|-------|---------|--------------|
| 3a Default | three slots filled | As drawn. |
| 3b Only primary (fresh install) | no keys yet | Slots 2 and 3 are dashed empty slots: "+ Add a backup model". Caption under them: "Optional. Used only if Gemini Nano can't run." Use `add-backup-model.svg` only if both are empty and there is room. |
| 3c Picker open | chevron pressed | Inline list as drawn; other slots dim to 60%. Escape or outside click closes. Selection applies immediately, no Save button. |
| 3d Model unavailable | key removed, key invalid, or Nano unsupported | Slot keeps its model, status line turns warning: "Key needed" / "Not available on this computer". Slot is skipped at run time. Tap goes to the fix (S4 or picker). |
| 3e Nano downloadable | Chrome has not downloaded the model | Slot status "Download needed (about {size})" + text button "Download". Then "Downloading 42%" with progress bar. |
| 3f Dragging | pointer or keyboard drag | Lifted card gets accent border and shadow; drop target shows a 2px accent line. Role labels update live. |
| 3g Saved | any change | No toast. The change itself is the confirmation; storage write is immediate. |
| 3h Model list loading | provider's model list is being fetched | Picker group shows `spinner` + "Loading models". On failure: "Couldn't load models. Try again", plus a free-text "Model ID" field as a fallback. |

Timeout options: 3, 5, 10, 20 seconds. Default 5.

### S4 Providers & API keys

Purpose: connect a provider so its models can be used in S3.

```
+------------------------------------------+
| <  Providers & API keys                  |  C2
+------------------------------------------+
|  Gemini Nano                  (*) Ready  |  C11 built-in       56
|  Built into Chrome, no key needed        |
|  ----------------------------------------|
|  Anthropic            (*) Connected  ... |  C11 connected
|  Key ending 4f2a                         |
|  ----------------------------------------|
|  OpenRouter           (*) Connected  ... |
|  Key ending 9c1d                         |
|  ----------------------------------------|
|  OpenAI                   Not connected  |  C11 expanded
|  API key                                 |  label
|  [ ********************* (eye)] [Save &] |  C12 KeyField
|                                 [ test ] |
|  Stored only in this browser. Sent only  |  micro
|  to OpenAI.                              |
|  ----------------------------------------|
|  Custom endpoint                 [ Add ] |  C11 + C14 outline
|  Any OpenAI-compatible URL               |
|                                          |
|  A connected provider's models appear    |  C17
|  in Model order.                         |
+------------------------------------------+
```

Only one provider is expanded at a time. Tapping a "Not connected" row expands it.

States

| State | Trigger | What changes |
|-------|---------|--------------|
| 4a Default | | Collapsed rows, as drawn minus the expanded block. |
| 4b Entering key | row expanded | Field focused. "Save & test" disabled until the field is non-empty. Paste is the expected input. |
| 4c Testing (loading) | Save & test pressed | Button shows `spinner` + "Testing". Field read-only. Typical 1-3s; hard timeout 10s. |
| 4d Success | test call passes | Row collapses to "Connected, key ending xxxx" with `success-check` once. If a model slot is empty, an info banner offers "Use as backup model" (one tap, assigns the provider's default model to the first empty slot). |
| 4e Invalid key (error) | provider rejects the key | Field border danger, message under it: "OpenAI didn't accept this key. Check it and try again." Key stays in the field. Nothing is saved. |
| 4f Network / provider down (error) | no response | "Couldn't reach OpenAI. Your key wasn't checked." Buttons: "Try again", "Save anyway". |
| 4g No credit / rate limited (error) | provider accepts key but refuses the call | "The key works, but OpenAI refused the request ({reason in plain words})." Saved as connected with a warning dot. |
| 4h Manage key | overflow (...) on a connected row | Menu: "Replace key", "Remove". |
| 4i Remove confirm | Remove chosen | Inline in the row, not a modal: "Remove this key? Claude Haiku will be skipped until you add one." [Cancel] [Remove]. Remove is danger-styled. |
| 4j Custom endpoint form | Add pressed | Fields: Name, Base URL, API key (optional), Model ID. Same test/save states as 4c-4g. |
| 4k Nano not supported (unavailable) | device or browser can't run it | First row reads "Not available on this computer" with hollow warning dot, and a "Why?" text link to a help page. |

Key handling (implementation notes)

- Store keys in `chrome.storage.local`, never `storage.sync`. Never log them. Never expose them to content scripts; calls go from the service worker.
- After saving, only the last 4 characters are ever shown. There is no "reveal saved key"; the user replaces it.
- The eye button reveals only the text currently being typed.

---

## 5. In-page chip (context for the popup's states)

Not a popup screen, but the popup's status words must match it. Anchored inside the platform's message box, bottom-left.

```
 idle      [ * Enter to refine ]
 refining  [ o Refining with Gemini Nano ]            text dims, border accent
 refined   [ v Refined, Gemini Nano ]  Undo           Enter now sends
 backup    [ v Refined, Claude Haiku (backup) ] Undo  warning tint
 failed    [ ! Couldn't refine, Enter sends your original ]  Try again
```

- Undo restores the exact original text and caret position. Available until the message is sent.
- Editing the refined text is allowed and does not trigger another refinement.
- Shift+Enter always inserts a newline and never triggers refinement.
- Empty or very short input (under about 3 words): no refinement, Enter sends as normal.

---

## 6. UX journeys

Each journey lists the shortest path. Counts are clicks after the popup is open.

### J1 Turn refinement off or on (1 click)

1. Open popup (S1).
2. Press the power button.
3. Button, title, pill and toolbar icon change at once. Done; closing the popup is not required.

Variant, one site only (1 click): flip "Refine on {site}" instead.
Keyboard: popup opens with focus on the power button; Space or Enter toggles.

### J2 See which model is working (0 clicks)

1. Open popup. The model card states the model, where it runs, and its status.
2. If a backup is in use, the card lists all three slots and the warning banner names where text is sent.

### J3 Change the primary, secondary or fallback model (3 clicks)

1. S1 > "Models & keys" (S3).
2. Press the chevron on the slot.
3. Pick a model. The picker closes; the slot updates. Saved immediately.

Reorder instead: drag a slot, or focus its handle and press Space, arrows, Space.

### J4 Connect a provider and use it as a backup (4 clicks + paste)

1. S1 > "Models & keys" > "Providers & API keys" (S4).
2. Tap the provider. Paste the key.
3. "Save & test". Wait for the check mark.
4. Tap "Use as backup model" in the banner. Done.

Shortcut from S3: an empty slot's "+ Add a backup model" opens the picker; a provider without a key
links straight to its expanded row in S4, and returns to the picker after a successful test.

### J5 Replace or remove a key (3 clicks)

1. S4 > overflow (...) on the provider.
2. "Replace key" (opens 4b) or "Remove".
3. Confirm inline. Any slot using that provider shows "Key needed" and is skipped.

### J6 Manage platforms (2 clicks)

1. S1 > "Platforms" (S2).
2. Flip a toggle. Saved immediately. An open tab on that site picks the change up without reload.

Add a site: open the site, open the popup, S2 > "Add the site in this tab" (or the "Add this site" button on S1 state 1d).

### J7 Primary model can't run (0 clicks when a backup exists)

1. Promptizer moves down the order by itself.
2. The in-page chip names the backup that did the work.
3. Toolbar icon gains the amber dot; S1 shows state 1e.
4. When the primary recovers, everything returns to 1a without user action.

No backup configured: S1 shows 1f with one button, "Add a backup model", which starts J4.

### J8 Everything failed (0 clicks to keep working)

1. Chip: "Couldn't refine, Enter sends your original". The prompt is untouched.
2. Toolbar icon shows the red dot; S1 shows 1g with "Check models".
3. "Check models" opens S3, where the failing slots show their reason.

---

## 7. State matrix

| Kind        | S1 Main                         | S2 Platforms                 | S3 Models                         | S4 Providers                     |
|-------------|---------------------------------|------------------------------|-----------------------------------|----------------------------------|
| Loading     | none (instant from storage)     | none                         | 3h model list, 3e download        | 4c testing key                   |
| Success     | 1a Active                       | 2c row added                 | 3g silent save                    | 4d connected                     |
| Empty       | 1d unsupported site             | 2b all off                   | 3b backup slots empty             | none (Nano is always listed)     |
| Unavailable | 1f primary can't run, 1e backup | 2d tab can't be added        | 3d model unavailable              | 4k Nano not supported            |
| Error       | 1g all failing                  | 2e permission denied         | 3h list failed                    | 4e invalid, 4f network, 4g refused |

Error copy pattern: what happened, in the user's terms, then the one thing to do. No codes, no stack
text. Provider error detail goes behind a "Details" text button if support needs it.

Gemini Nano availability mapping (verify names against the current Chrome built-in AI docs before coding):

| Chrome reports  | Slot status shown                    | Behavior                         |
|-----------------|--------------------------------------|----------------------------------|
| available       | On-device, Ready                     | used                             |
| downloadable    | Download needed + "Download"         | skipped until downloaded         |
| downloading     | Downloading NN% + progress bar       | skipped; auto-resumes when ready |
| unavailable     | Not available on this computer       | skipped permanently              |

---

## 8. Interaction patterns

- Save model: every control saves on change. No Save buttons except "Save & test" for keys, because a key needs validating.
- Navigation: push/pop within one popup document. Back button top-left; Escape also goes back (and closes the popup from S1, which is Chrome's default).
- Destructive actions confirm inline in the row. No modals anywhere in the popup.
- Disabled controls say why in adjacent text, never by tooltip alone.
- One expanded thing per screen (one picker in S3, one provider in S4). Opening another closes the first.
- Toggles take effect in open tabs without a reload (message from service worker to content script).
- Toolbar icon mirrors S1: on, off, backup (amber dot), error (red dot). Its tooltip repeats the pill text.
- Focus: on open, the power button. After push, the screen's back button. After pop, the row that was activated.
- Feedback timing: under 100ms for local changes, spinner after 300ms for network actions, timeout message at 10s.

---

## 9. Responsive behavior

A popup has no breakpoints in the usual sense, but its size and content vary.

- Width: fixed 360px. Works down to 320px (rows are flex; values truncate before labels).
- Height: content-sized, min 480, max 580 (Chrome caps popups at 600). Header stays fixed; the body scrolls when content exceeds the max. Sticky bottom actions (S2 add button) stay visible.
- Long text: labels wrap to two lines; right-side values truncate with an ellipsis and expose the full text via `title` and `aria-label`. Model names truncate in the middle of S1's fallback line only.
- Localization: budget 40% text growth. Test with Vietnamese and German strings; 48px rows grow to 56px rather than shrinking type.
- Browser zoom / large default font: sizes are in rem off a 16px root, so the layout scales; at 200% the body scrolls and nothing overlaps.
- Compact rule: when S1 would exceed max height (state 1e, or 1g with banner), the power button drops from 124 to 104 and the footer note is removed before anything scrolls.
- Right-to-left: mirror chevrons, back arrow and toggle direction; keep the power button centered.
- Side panel (optional later): the same screens work at 320-480 wide with no changes because nothing depends on a fixed height.

---

## 10. Accessibility checklist

- Every control is a native `button`, `a` or `input`. Toggles are `button[role=switch][aria-checked]`.
- Power button: `aria-pressed`, and its label states the action ("Turn prompt refinement off").
- Icon-only buttons have `aria-label`; decorative SVGs have `aria-hidden="true"`.
- Visible focus ring: 2px accent, 2px offset, on every focusable element.
- Tab order follows visual order. No keyboard traps. Drag-and-drop has a keyboard path (Space to lift, arrows to move, Space to drop, Escape to cancel) and announces "Moved to position 2, Secondary".
- Status changes are announced through one `aria-live="polite"` region (pill text and key test results). Errors that block an action use `role="alert"`.
- Text contrast is at least 4.5:1 (lowest is 6.3:1); control borders at least 3:1.
- Targets at least 44x44.
- Motion respects `prefers-reduced-motion`.
- Inputs have visible labels. The key field uses `autocomplete="off"` and `spellcheck="false"`.

---

## 11. Asset manifest

All paths are under `assets/`.

### Icons (`icons/`, 24x24, 2px stroke, `currentColor`)

Inline these in markup so they take the text color. Loaded through `<img>` they render black.

| File | Used in |
|------|---------|
| `logo.svg` | C1 header |
| `power.svg` | C4 |
| `chevron-right.svg`, `chevron-left.svg`, `chevron-down.svg` | C6, C2 back, C9/select |
| `drag-handle.svg` | C9 |
| `more.svg` | C11 overflow |
| `plus.svg` | dashed-add button, empty slot |
| `close.svg` | dismiss banner, cancel custom endpoint |
| `check.svg` | success chip, picker selected option |
| `warning.svg` | "Using backup" pill, warning banner |
| `error.svg` | "Needs attention" pill, danger banner, failed chip |
| `info.svg` | info banner |
| `sparkle.svg` | idle chip |
| `key.svg` | "Key needed" status |
| `eye.svg`, `eye-off.svg` | C12 show/hide |
| `trash.svg` | Remove in overflow menu |
| `undo.svg`, `retry.svg` | chip actions, "Try again" |
| `device.svg`, `cloud.svg` | optional prefix for "On-device" / "Cloud" status |
| `globe.svg` | custom site and custom endpoint tile |

### Toolbar (`toolbar/`, source for PNG export)

Chrome's action icon needs PNG. Export each at 16, 32, 48 and 128px.

| File | State |
|------|-------|
| `toolbar-on.svg` | active |
| `toolbar-off.svg` | paused or site off (grey reads on both light and dark toolbars: 3.2:1 / 5.0:1) |
| `toolbar-backup.svg` | backup model in use |
| `toolbar-error.svg` | all models failing |

### Illustrations (`illustrations/`, 160x120, fixed colors for the dark theme)

| File | State |
|------|-------|
| `unsupported-site.svg` | 1d |
| `platforms-empty.svg` | 2b |
| `add-backup-model.svg` | 3b |
| `nano-unavailable.svg` | 1f, 4k |
| `all-models-failed.svg` | 1g (only if height allows; the banner alone is enough) |

### Animations (`animations/`, CSS inside the SVG, stop under reduced motion)

| File | Size | Loop | Used in |
|------|------|------|---------|
| `spinner.svg` | 24 | yes | buttons (4c), picker loading (3h) |
| `refining.svg` | 24 | yes | refining chip |
| `success-check.svg` | 24 | once | 4d, 2c |
| `power-pulse.svg` | 156 | once | reference for the power-on ring; implement the ring as CSS around C4 |
| `progress-indeterminate.svg` | 120x4 | yes | downloads before a % is known |

---

## 12. Open decisions

1. Refinement trigger. This plan assumes first Enter refines, second Enter sends. If you want zero extra
   keypresses, add one SettingRow on S1, "Send automatically after refining", default off. Nothing else changes.
2. Provider list for v1. The plan shows Anthropic, OpenRouter, OpenAI and a custom endpoint. Model names in
   wireframes are placeholders; the picker should list whatever each provider returns.
3. Platform list for v1. Six are drawn; confirm which ones ship with tested selectors.
4. Light theme: out of scope here; tokens are ready for it.
