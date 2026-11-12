# Promptizer MVP

Local-first prompt refinement for the terminal and supported Chrome composers. The approved behavior is a manual whole-prompt rewrite into one clean, professional paragraph that preserves the core task, intent, and important context. The rewrite is shown as a preview and never submitted automatically. The browser uses Chrome's on-device Gemini Nano first and the existing Groq service as a configurable fallback. The CLI continues to use Groq.

## Current status

The MVP implementation is ready for manual acceptance testing. The compiled CLI, authenticated loopback service, pairing flow, Gemini Nano browser provider, Groq fallback, ChatGPT and Claude adapters, context controls, and opt-in live mode are implemented. Automated normal/race/security/provider-routing/fixture tests pass on the current 16 GB Apple M2 Mac mini. Real Nano inference, real-site compatibility, Chrome extension resource use, human quality review, and final 8 GB Mac reproduction remain manual gates.

## Build and verify

Requirements: Go 1.26+, Google Chrome, Node.js for extension tests, `jq`, and a Groq key in the ignored `.env` file.

```bash
cd /Users/phongmac/PersonalWorkspace/promptizer
make verify
```

The build output is `./bin/promptrefine`. No third-party Go or JavaScript packages are installed.

## Start using the CLI

Load `.env` into the current shell without printing it:

```bash
set -a
. ./.env
set +a

printf '%s\n' 'make contact button sticky but dont change existing design' | \
  ./bin/promptrefine refine
```

Optional modes:

```bash
./bin/promptrefine refine --json < draft.txt
./bin/promptrefine refine --context-file ./selected-context.txt < draft.txt
```

Prompts must come from stdin so they do not enter shell history.

## Start the browser extension

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this repository's `extension/` directory.
2. Open Promptizer settings from its toolbar icon.
3. Leave **Gemini Nano first** selected and click **Check or download Gemini Nano**. Keep the settings page open until it says **Ready on this device**.
4. On ChatGPT or Claude, type at least eight characters and use **Refine draft** or Command+Shift+Y.

Chrome 138+ is required. Nano also requires supported desktop hardware, macOS 13+ on Mac, about 22 GB free disk, and an unmetered connection for the first download. When Nano is unavailable, Promptizer can use Groq fallback.

### Enable Groq fallback

The `.env` file is already ignored. Load it without printing its contents, then pair and start the local service:

```bash
set -a
. ./.env
set +a

./bin/promptrefine pair
# Paste the printed token into Groq fallback pairing in extension settings and save.

export PROMPTREFINE_EXTENSION_ORIGIN='chrome-extension://YOUR_EXTENSION_ID'
./bin/promptrefine serve
```

Keep that terminal open. In another terminal:

```bash
./bin/promptrefine health
```

The preview identifies whether **Gemini Nano · on-device** or **Groq · cloud fallback** produced it. Review and optionally edit the result, then choose **Replace** or **Dismiss**. Promptizer never submits the message.

If you explicitly enable **Inline suggestions** in settings, Promptizer shows a compact recommendation after a meaningful typing pause without moving focus out of the composer. Press **Tab** at the end of the draft to accept or **Esc** to dismiss; continuing to type discards the stale suggestion.

Stop the service with Ctrl+C. Rerunning `promptrefine pair` revokes the previous extension token.

Follow the complete [manual test checklist](docs/manual-test.md) before treating the site adapters as accepted.

See [troubleshooting](docs/troubleshooting.md), [security and privacy](docs/security-privacy.md), [benchmarks](docs/benchmarks.md), and [known limitations](docs/known-limitations.md) for release-candidate evidence.

## Development and evaluation commands

```bash
./scripts/test-mock.sh

# Live candidate comparison; .env remains ignored and its values are not printed.
set -a; . ./.env; set +a
go run ./scripts/evaluate-groq/main.go
```

The mock listens only on `127.0.0.1:18765`, accepts the test credential `mock-key`, returns a fixed model list, and serves deterministic Chat Completions responses. It sends no network traffic outside loopback.

The provisional model default is `openai/gpt-oss-120b`. See [docs/model-evaluation.md](docs/model-evaluation.md) for the authenticated model inventory, fixed-case results, limitations, and why the default is not yet a Phase 5 quality claim.

## Commands

```bash
make verify
printf '%s\n' 'rewrite this prompt' | ./bin/promptrefine refine
./bin/promptrefine serve
./bin/promptrefine pair
./bin/promptrefine health
```

## Request limits

These limits are enforced by the CLI/service and mirrored by the extension trigger filters:

| Boundary | Limit | Behavior |
|---|---:|---|
| Explicit prompt minimum | 8 trimmed Unicode characters | Reject locally; no Groq request |
| Live-mode minimum | 20 characters and 3 words | Do not schedule a request |
| Prompt maximum | 4,000 UTF-8 bytes | Reject; never truncate the prompt silently |
| Context maximum | 2,000 UTF-8 bytes | Trim context first within the model-input budget |
| Constraints | 8 × 200 UTF-8 bytes | Reject excess constraints |
| Request body | 8 KiB | Reject before decoding/provider call |
| Intended total model input | Approximately 1,024 tokens | Measure usage; trim optional context first |
| Groq completion | 192 tokens | Sent as `max_completion_tokens` |
| Gemini Nano output | 4,000 schema characters and 4,000 validated UTF-8 bytes | Prompt API has no direct completion-token parameter; reject invalid/oversized output |
| Decoded refined prompt | 4,000 UTF-8 bytes, one paragraph | Reject invalid provider output |

The minimum is character-based rather than token-based so Promptizer does not need a model-specific tokenizer or a provider call merely to decide whether a request is allowed. Groq itself does not provide the product-level “meaningful prompt” rule; Promptizer owns it.

## Privacy boundary

Only the prompt and optional context that the user explicitly selects are processed. Nano keeps them on-device. They may be sent to Groq only when Groq-only mode is selected or the disclosed fallback is enabled and needed. The MVP must not inspect terminal keystrokes, crawl files, scrape a whole page or conversation, persist prompt text, expose the Groq key to Chrome, or modify/send a draft without deliberate acceptance. See [docs/scope.md](docs/scope.md).

