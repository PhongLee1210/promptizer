# AGENTS.md

## What this repo is

Promptizer rewrites a messy prompt into one clean paragraph, keeping the original task and intent.
It ships two parts:

- `cmd/promptrefine` + `internal/` — Go CLI and an authenticated `127.0.0.1` service that calls Groq.
- `extension/` — Chrome MV3 extension for ChatGPT and Claude that uses on-device Gemini Nano first and the local Groq service as fallback.

The rewrite is always shown as an editable preview. Nothing is submitted automatically.

## Rules

- No comments in the code. Names and structure carry the meaning; ESLint enforces this for `extension/`.
- Keep the existing structure. Edit the files that are already there instead of adding new ones unless a new file is genuinely required.
- Keep it small and simple. There is no limit on file or function length, so prefer extending an existing file over splitting it.
- No third-party Go dependencies. No third-party runtime JavaScript dependencies beyond the extension framework's own bundled helpers, and no UI framework. WXT, Vite, Vitest and ESLint are the permitted dev dependencies.
- Never print or commit `.env`.

## Verify

```bash
make verify   # go tests, race, extension tests, eslint, build
make lint     # eslint only
```
