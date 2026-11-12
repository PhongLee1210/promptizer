# Troubleshooting

## Gemini Nano says unavailable

Confirm Chrome 138+ on desktop, macOS 13+ on Mac, at least 22 GB free disk, and either more than 4 GB GPU VRAM or at least 16 GB RAM with four CPU cores. Open Promptizer settings and click **Check or download Gemini Nano** on an unmetered connection. Chrome's `chrome://on-device-internals` page shows model broker and download state. If the device is unsupported, keep **Allow Groq fallback** enabled.

## Gemini Nano says not downloaded

Chrome requires a user action to start the model download. Background and live refinements intentionally do not trigger it. Use the settings button, keep that page open through 100%, then retry.

## Test fallback without changing the device

Choose **Groq only — compatibility mode**, save, and refine a draft. The preview must say **Groq · cloud fallback**. Switch back to **Gemini Nano first** and disable **Allow Groq fallback** to verify that a Nano failure preserves the draft and performs no cloud request.

## CLI says the credential is missing

Load the ignored `.env` into the same shell before running the command:

```bash
set -a
. ./.env
set +a
```

Do not paste the key into command arguments, extension settings, or source files.

## Extension says fallback pairing is required

Nano itself needs no pairing. This message means Nano could not handle the request and the enabled Groq fallback is unpaired. Run `./bin/promptrefine pair`, paste the printed token into extension options, and save. Rerunning `pair` invalidates the previously saved token.

## Service rejects the extension origin

Open extension options, copy the displayed `chrome-extension://...` origin, stop the service, and restart it with:

```bash
export PROMPTREFINE_EXTENSION_ORIGIN='chrome-extension://CURRENT_ID'
./bin/promptrefine serve
```

Do not add a trailing slash.

## Service is unavailable

Run `./bin/promptrefine health`. If it fails, start `serve` in a terminal loaded with `.env`. Check whether another process owns port 8765. Promptizer never starts automatically.

## Unsupported editor

Confirm the page is `https://chatgpt.com/` or `https://claude.ai/`, focus the primary prompt composer, reload the unpacked extension, then reload the page. If detection still fails, record the site, Chrome version, and date; do not broaden selectors to arbitrary textareas.

## Replace fails

Use **Copy** in the preview and paste manually. Promptizer attempts to restore the original when editor-compatible insertion cannot be verified.

## Provider errors or Vietnamese failures

The draft remains unchanged. Retry once manually. Persistent `json_validate_failed`, 429, authentication, or model-availability failures should be recorded rather than hidden by repeated automatic retries.

