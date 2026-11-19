# E2E Feature User Journeys

ASCII flow + expected output per feature. Status tag shows if wired end-to-end.

---

## BASIC FEATURES

### 1. Chip trigger + Nano refine (happy path)
Status: FULL

```
user types prompt (>=8 chars)
   |
   v
click chip -----> rail opens -----> click "refine"
                                        |
                                        v
                              Nano runs on-device
                                        |
                                        v
                          preview window shows rewrite
                                        |
                        +---------------+---------------+
                        v                               v
                   [Replace]                       [Dismiss]
                        |                               |
                        v                               v
              editor text replaced              original text untouched
```
Expected: preview is editable, never auto-submitted. Replace writes exact preview text into editor.

### 2. Editor detection
Status: FULL

```
focus textarea/contentEditable on any site (content script matches <all_urls>)
   |
   v
resolveEditableTarget() identifies element
   |
   v
chip anchors next to it
```
Expected: chip appears only on recognized editable element; no chip on random page text.

### 3. Replace into editor
Status: FULL

```
Replace clicked
   |
   v
try native setter -> try execCommand -> try beforeinput -> raw textContent
   |
   v
input event dispatched (React/ProseMirror sees the change)
```
Expected: host site's own state updates (not just visual DOM write), send button enables normally.

### 4. Undo
Status: FULL

```
Replace done -----> Undo button visible (6s window)
                          |
                          v
                   click Undo before timeout
                          |
                          v
                   original text restored
(after 6s: Undo button gone, change is permanent)
```
Expected: undo only works inside 6s window.

### 5. Result history (10-cap, prev/next, delete)
Status: FULL

```
run action -> result #1 stored
run action again -> result #2 stored
   |
   v
[< prev] [2/2] [next >]
   |
   v
delete current -> drops from history, counter shrinks
(11th result pushes out oldest)
```
Expected: max 10 entries kept, counter always matches position.

### 6. Inline edit of a result
Status: FULL

```
view result -----> click Edit -----> textarea appears
                                          |
                            +-------------+-------------+
                            v                           v
                         Save                       Discard
                            |                           |
                            v                           v
                   entry marked "edited"         reverts to original result
```
Expected: edited result replaces the one shown; Replace then uses edited text.

### 7. Copy to clipboard
Status: FULL

```
click Copy
   |
   v
navigator.clipboard.writeText()
   |
   +--success--> label flashes "Copied" (1.2s)
   |
   +--fail------> silently no-ops, no crash
```
Expected: no error thrown even if clipboard permission denied.

### 8. Global enable/disable
Status: FULL

```
popup: click power toggle OFF
   |
   v
storage.local "popupState.globalEnabled" = false
   |
   v
content script listens via storage.onChanged
   |
   v
chip stops appearing on any site
   |
   v
toggle ON -----> chip reappears on next focus
```
Expected: takes effect without page reload.

### 9. Popup settings shell
Status: FULL (UI only)

```
open popup
   |
   v
Main screen -----> drawer: Platforms / Models / Providers / Suggestions
   |
   v
navigate screens, state persists across popup close/reopen
```
Expected: navigation works, state loads back (STORAGE_SCHEMA v2 migration applies for old data).

---

## ADVANCED FEATURES

### 10. Action rail (9 actions + sub-menus)
Status: FULL

```
click chip -----> rail expands
   |
   v
refine | improve | grammar | shorten | translate> | tone>
                                          |            |
                                          v            v
                                     vi / en     pro/friendly/direct
```
Expected: arrow keys / Home / End move focus; Escape closes rail.

### 11. Tweak menu on result
Status: FULL

```
result shown -----> click Tweak
                         |
                         v
                  shorten | grammar | tone> | translate>
                         |
                         v
            re-runs action on the RESULT TEXT (not original prompt)
```
Expected: original prompt never re-sent; only the visible result is the input.

### 12. Output validation guardrails
Status: FULL

```
model returns text
   |
   v
decision must be "keep" or "refine"
   |
   v
<=4000 bytes, single paragraph, no \r\n, no heading/list markers
   |
   v
"keep" must echo original exactly
   |
   +--pass--> accepted
   +--fail--> rejected, draft preserved, can retry
```
Expected: malformed model output never reaches the editor.

### 13. Model fallback-order UI (multi-provider slots)
Status: STUB — UI only, no execution path

```
popup -----> Models screen -----> reorder slots (primary/backup/fallback)
                                        |
                                        v
                              saved to storage... and nothing reads it
```
Expected (current real behavior): reordering has zero effect on actual refine routing. Content script only ever uses Nano — there is no cloud fallback.

### 14. Provider key "Save & test"
Status: STUB

```
type key -----> click "Save & test"
                     |
                     v
              setTimeout(10ms)
                     |
                     v
            length >= 8? "success" : "invalid-key"
            (no network call ever made)
```
Expected (current real behavior): any 8+ character string "succeeds" regardless of validity. Key itself not persisted, only last 4 chars.

### 15. Per-site platform toggle
Status: GAP — UI works, not enforced

```
popup -----> Platforms screen -----> toggle claude.ai OFF
                                            |
                                            v
                                   storage updated... content script
                                   never reads PlatformEntry.enabled
                                            |
                                            v
                                   chip still appears on claude.ai
```
Expected (current real behavior): only the global on/off switch (#8) has any effect; per-site toggle is cosmetic.

### 16. Suggestion settings (live mode, categories, underline)
Status: DEAD STORAGE

```
popup -----> Suggestions screen -----> toggle "live mode" / categories / underline
                                              |
                                              v
                                   saved to storage, never read by content script
```
Expected (current real behavior): no visible change in behavior regardless of toggle state.

### 17. Keyboard shortcut (Cmd/Ctrl+Shift+Y)
Status: DEAD

```
press Cmd+Shift+Y
   |
   v
chrome fires "refine-prompt" command
   |
   v
NO background script, NO onCommand listener -----> nothing happens
```
Expected (current real behavior): shortcut does nothing. `wxt.config.ts` still declares the command; nothing consumes it.

---

## AI INTEGRATIONS

### 18. Gemini Nano (on-device, primary)
Status: FULL

```
action triggered -----> nanoAvailability() check
                              |
                 +------------+------------+
                 v                         v
            available                 unavailable
                 |                         |
                 v                         v
     warm session reused/created    surface error
     (or created fresh, 180s idle         |
      eviction)                           v
                 |                 (Nano is the only
                 v                  refine path — no cloud
     JSON-schema constrained        fallback of any kind)
     output -----> validate -----> return result
```
Expected: no network call; works offline. Requires Chrome 138+, ~16GB RAM/4 cores in practice.

Note: the Groq cloud-fallback path (local Go service + pairing-token auth) that previously backed the "refine" action has been removed entirely. Nano failures now surface directly for every action, with no fallback. The Go CLI/service (`cmd/promptrefine`, `internal/`) no longer exists in this repo.

### 19. Language-aware routing (Vietnamese)
Status: MISSING

```
docs claim:
  Vietnamese/non-Latin input -----> detected -----> routed to a dedicated path

src/ actual:
  Vietnamese/non-Latin input -----> NO detector exists -----> goes to Nano same as any input
```
Expected (current real behavior): needs direct observation — likely Nano attempts anyway since Nano doesn't officially support vi; outcome (garbage output vs quiet failure) is untested, flagged as open question.

### 20. Popup Nano status display
Status: FAKE

```
popup opens -----> Models screen shows "gemini-nano: Ready"
                         |
                         v
              this is a HARDCODED default, never calls real nanoAvailability()
                         |
                         v
   even if Nano is actually unavailable on this device, popup still says "Ready"
```
Expected (current real behavior): popup status is cosmetic, does not reflect true device state.

---

## Legend
- FULL — implemented, wired end-to-end, works as described
- PARTIAL — implemented for some paths, not others
- GAP — UI/storage exists but not connected to behavior
- STUB — fake implementation, no real backend call
- DEAD STORAGE — persisted setting, nothing reads it
- MISSING — described in docs, not present in active code
- FAKE — displays static/hardcoded value, not live state
