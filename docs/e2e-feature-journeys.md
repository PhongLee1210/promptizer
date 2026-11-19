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
focus textarea/contentEditable on claude.ai or chatgpt.com
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

### 10. CLI `promptrefine refine`
Status: FULL

```
printf "rushed prompt" | ./bin/promptrefine refine
   |
   v
reads stdin (bounded) -> calls refine service -> prints clean paragraph
   |
   +-- --json -----> structured output
   +-- --context-file ----> extra context merged in
```
Expected: prompt never touches shell history; errors map to readable messages.

### 11. CLI `pair` / `serve` / `health`
Status: FULL

```
./bin/promptrefine pair
   |
   v
prints token -----> paste into extension pairing field (legacy extension only)

./bin/promptrefine serve
   |
   v
starts 127.0.0.1:8765, loads token, graceful shutdown on SIGINT/SIGTERM

./bin/promptrefine health
   |
   v
GET /healthz -----> 200 ok (2s timeout)
```
Expected: `serve` refuses to start without a token from `pair` first.

---

## ADVANCED FEATURES

### 12. Action rail (9 actions + sub-menus)
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

### 13. Tweak menu on result
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

### 14. Pairing-token auth (Groq access control)
Status: GAP — Go side full, no UI in `src/` to set token

```
Go side (full):
  pair -> token saved 0600 -----> serve checks Authorization header
                                       |
                             constant-time compare
                                       |
                            match: proceed  /  mismatch: 401

src/ extension (missing):
  background.ts reads storage.pairingToken
       |
       v
  NO screen anywhere writes this value  <-- dead end
```
Expected (current real behavior): Groq fallback in `src/` build can never authenticate — always fails `not-configured`. Only legacy `extension/options.js` pairing field works.

### 15. Server cache / dedup
Status: FULL

```
request A -----> SHA-256(prompt+model) -----> cache miss -----> call Groq -----> store
request A again (same hash, <10min) -----> cache hit -----> instant return, no Groq call
```
Expected: identical repeated requests skip provider call.

### 16. Busy guard (single-flight)
Status: FULL

```
request 1 in flight -----> request 2 arrives concurrently
                                 |
                                 v
                           HTTP 429 "BUSY"
```
Expected: no overlapping Groq calls from one server instance.

### 17. Retry with backoff
Status: FULL

```
Groq returns 429/5xx -----> isTransient? -----> retry once (honors Retry-After)
                                                      |
                                           still fails -> surface error
(live-trigger mode: retry SKIPPED, fails fast)
```
Expected: manual "refine" retries once; as-you-type "live" mode never retries.

### 18. Output validation guardrails
Status: FULL (triplicated: Go / Nano / legacy JS)

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

### 19. Model fallback-order UI (multi-provider slots)
Status: STUB — UI only, no execution path

```
popup -----> Models screen -----> reorder slots (primary/backup/fallback)
                                        |
                                        v
                              saved to storage... and nothing reads it
```
Expected (current real behavior): reordering has zero effect on actual refine routing. Content script only ever tries Nano then Groq.

### 20. Provider key "Save & test"
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

### 21. Per-site platform toggle
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

### 22. Suggestion settings (live mode, categories, underline)
Status: DEAD STORAGE

```
popup -----> Suggestions screen -----> toggle "live mode" / categories / underline
                                              |
                                              v
                                   saved to storage, never read by content script
```
Expected (current real behavior): no visible change in behavior regardless of toggle state.

### 23. Keyboard shortcut (Cmd/Ctrl+Shift+Y)
Status: DEAD in `src/`

```
press Cmd+Shift+Y
   |
   v
chrome fires "refine-prompt" command
   |
   v
src/entrypoints/background.ts -----> NO onCommand listener -----> nothing happens
```
Expected (current real behavior): shortcut does nothing in active build. Works only in legacy `extension/`.

---

## AI INTEGRATIONS

### 24. Gemini Nano (on-device, primary)
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
                 |                 (only "refine" action
                 v                  falls through to Groq,
     JSON-schema constrained        see #25)
     output -----> validate -----> return result
```
Expected: no network call; works offline. Requires Chrome 138+, ~16GB RAM/4 cores in practice.

### 25. Groq cloud fallback (via local Go service)
Status: PARTIAL — only "refine" action has fallback

```
"refine" action, Nano fails
   |
   v
content script -----> runtime.sendMessage -----> background.ts
                                                        |
                                                        v
                                          POST 127.0.0.1:8765 (Bearer pairingToken)
                                          6.5s timeout, cache: no-store
                                                        |
                                              +---------+---------+
                                              v                   v
                                        token missing        token valid
                                              |                   |
                                              v                   v
                                     fails "not-configured"   Groq call -> result

other 8 actions (improve/grammar/shorten/translate/tone), Nano fails
   |
   v
error surfaced directly, NO Groq fallback attempted
```
Expected: only refine has a safety net; other actions are Nano-only today.

### 26. Language-aware routing (Vietnamese -> Groq)
Status: MISSING in `src/` (exists only in legacy `extension/`)

```
docs claim:
  Vietnamese/non-Latin input -----> detected -----> routed to Groq

src/ actual:
  Vietnamese/non-Latin input -----> NO detector exists -----> goes to Nano same as any input
```
Expected (current real behavior): needs direct observation — likely Nano attempts anyway since Nano doesn't officially support vi; outcome (garbage output vs quiet failure) is untested, flagged as open question.

### 27. Nano <-> Groq prompt contract sync
Status: FULL but fragile (comment + one test, no shared code)

```
edit Nano system instruction (nano.ts)
   |
   v
must manually also edit:
  - internal/refine/prompt.go (Go)
  - extension/nano.js (legacy)
   |
   v
nano-prompt-sync.test.ts catches ONLY the Nano<->Go drift, not legacy
```
Expected: if someone edits one and forgets the others, only Go/Nano mismatch is caught by test; legacy drift is silent.

### 28. Popup Nano status display
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
