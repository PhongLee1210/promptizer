# Promptizer

Rewrites your current prompt into one clean, professional paragraph, keeping the task and intent.
The result is always an editable preview — Promptizer never submits anything for you.

- **CLI** (`promptrefine`) — refines a prompt from stdin using Groq.
- **Chrome extension** — refines the draft in ChatGPT and Claude composers, using on-device Gemini Nano first and the local Groq service as fallback.

## Requirements

Go 1.26+, Node.js, `jq`, Chrome 138+, and a Groq API key in `.env` (copy from `.env.example`).

## Setup

```bash
npm install
make verify        # tests + lint + build -> ./bin/promptrefine
```

## Use the CLI

```bash
set -a; . ./.env; set +a

printf '%s\n' 'make contact button sticky but dont change existing design' | ./bin/promptrefine refine
```

Prompts come from stdin so they never land in shell history. Add `--json` or `--context-file ./context.txt` if needed.

## Use the extension

1. `chrome://extensions` → **Developer mode** → **Load unpacked** → select `extension/`.
2. Open Promptizer settings from the toolbar, click **Check or download Gemini Nano**, and wait for **Ready on this device**.
3. On ChatGPT or Claude, type at least 8 characters and press Command+Shift+Y (Ctrl+Shift+Y), then **Replace** or **Dismiss**.

Groq fallback (optional), in two terminals:

```bash
set -a; . ./.env; set +a
./bin/promptrefine pair      # paste the token into extension settings
export PROMPTREFINE_EXTENSION_ORIGIN='chrome-extension://YOUR_EXTENSION_ID'
./bin/promptrefine serve
```

```bash
./bin/promptrefine health
```

## Commands

```bash
make verify   # go tests, race, extension tests, eslint, build
make lint     # eslint on extension/
./scripts/test-mock.sh   # loopback mock Groq, no external traffic
```

## Privacy

Only the prompt and context you explicitly select are processed. Nano keeps them on-device; they reach Groq only in Groq-only mode or via the disclosed fallback. No prompt logging, page scraping, or automatic submission.

## More

[scope](docs/scope.md) · [manual test checklist](docs/manual-test.md) · [request limits](docs/request-limits.md) · [troubleshooting](docs/troubleshooting.md) · [security and privacy](docs/security-privacy.md) · [known limitations](docs/known-limitations.md) · [contributing rules](AGENTS.md)
