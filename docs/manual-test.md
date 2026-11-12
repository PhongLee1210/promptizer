# Manual MVP test checklist

Use this checklist after following the setup in `README.md`. Do not paste a real secret prompt during the first pass. Nano is on-device, but a request may go to Groq when the disclosed fallback is enabled.

## 1. CLI

```bash
printf '%s\n' 'make contact button sticky but dont change existing design' | ./bin/promptrefine refine
printf '%s\n' 'make contact button sticky but dont change existing design' | ./bin/promptrefine refine --json
```

- [ ] Output is one professional paragraph and preserves the existing-design constraint.
- [ ] `printf 'short\n' | ./bin/promptrefine refine` fails locally without a Groq request.
- [ ] A prompt argument such as `./bin/promptrefine refine 'secret'` is refused; stdin is required.
- [ ] `--context-file` uses only the explicitly selected file.
- [ ] No `promptrefine` process remains after the command exits.

## 2. Pairing and lifecycle

- [ ] `./bin/promptrefine pair` prints a new token and creates an owner-only token file.
- [ ] `./bin/promptrefine serve` binds to `127.0.0.1:8765` only.
- [ ] `./bin/promptrefine health` returns `{"provider":"groq","status":"ok"}`.
- [ ] Starting with `PROMPTREFINE_ADDR=0.0.0.0:8765` is rejected.
- [ ] Stop with Ctrl+C; health fails afterward and the port is released.

## 3. Install the unpacked extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the absolute `extension` directory in this project.
4. Click the Promptizer toolbar icon to open settings.
5. Leave **Gemini Nano first** selected and click **Check or download Gemini Nano**.
6. Confirm download progress is visible and wait for **Ready on this device**. Record Chrome version, availability result, and download duration.
7. For fallback testing, copy the displayed extension origin and use it as `PROMPTREFINE_EXTENSION_ORIGIN` when starting the service.
8. Paste the output from `promptrefine pair` into **Pairing token**, keep **Manual** selected, allow Groq fallback, and save.

## 3A. Provider routing

- [ ] With Nano ready and the local service stopped, refine an English draft; the preview says **Gemini Nano · on-device**.
- [ ] In DevTools, confirm the Nano-ready request makes no call to `127.0.0.1:8765` and no Groq request.
- [ ] Choose **Groq only**, start the paired service, and refine; the preview says **Groq · cloud fallback**.
- [ ] Switch back to **Gemini Nano first**, disable Groq fallback, then simulate Nano unavailability; the draft remains unchanged and no loopback request occurs.
- [ ] Re-enable fallback and test a Vietnamese prompt; it routes to Groq and still produces one paragraph.
- [ ] Cancel an in-flight Nano request; it does not initiate Groq fallback.
- [ ] Reload the extension/service worker and repeat one Nano request to confirm worker-context availability on this Chrome version.

## 4. ChatGPT manual mode

- [ ] Open ChatGPT, enter a draft longer than eight characters, and do not send it.
- [ ] Press Command+Shift+Y or choose **Refine draft**.
- [ ] Original and refined text appear in the preview; the composer remains unchanged.
- [ ] Edit the refined preview, choose **Replace**, and verify the composer contains the edited text.
- [ ] The message is not sent automatically.
- [ ] Choose **Dismiss** on a second attempt; the original remains unchanged.
- [ ] Type while a request is pending; the stale result is canceled/discarded and never replaces new text.
- [ ] Stop the service and retry; ChatGPT typing and sending continue normally.
- [ ] Test multiline paste and keyboard-only Tab/Shift+Tab/Escape operation with visible focus.

## 5. Claude manual mode

Repeat the ChatGPT checks on Claude. If the current editor DOM is not recognized, Promptizer must show an unsupported-editor status and must not modify the page. Record the Chrome and site date if selectors need maintenance.

## 6. Explicit context

- [ ] Add a short task summary in options and confirm it improves a relevant draft without adding unrelated requirements.
- [ ] Select text from no more than two visible conversation turns, trigger Promptizer, and confirm the context-consent step appears before any request.
- [ ] Uncheck selected context and continue; only the task summary and prompt should be used.
- [ ] Confirm whole-thread text is never collected automatically.

## 7. Live mode

- [ ] Confirm Manual is the default and no requests occur while idle.
- [ ] Explicitly select Live in options.
- [ ] Fewer than 20 characters or fewer than three words makes no request.
- [ ] Type continuously for 60 seconds; requests occur only after 650 ms pauses and never more frequently than every four seconds.
- [ ] Blur the editor, hide/switch the tab, or use IME composition; requests stop.
- [ ] Confirm the live suggestion appears without moving focus out of the composer and clearly states that Tab accepts and Esc dismisses.
- [ ] With the caret at the end, press Tab and verify the suggestion replaces the draft without submitting it or triggering another live request loop.
- [ ] Move the caret into the middle of the draft, select text, use Shift+Tab, and use Command+Tab; verify Promptizer does not intercept any of those actions.
- [ ] Continue typing while a suggestion is visible and verify the stale suggestion closes without changing the draft.
- [ ] Use the visible Accept suggestion, Copy, Dismiss, and Esc paths with keyboard-only navigation and visible focus.
- [ ] Disable Promptizer and confirm all calls stop.

## 8. Privacy and resources

- [ ] Chrome DevTools page storage and console contain no pairing token or Groq key.
- [ ] The Groq key exists only in the host process environment.
- [ ] Chrome Task Manager shows an acceptable extension idle footprint; record the before/after delta.
- [ ] Activity Monitor plus the service remains far below the absolute 2 GB incremental ceiling.
- [ ] Chrome Task Manager records Nano inference peak memory/CPU and idle values. Note that Chrome's model memory belongs to Chrome, not the Go service.

Record failures in `PLAN.md` without checking the affected acceptance item.

