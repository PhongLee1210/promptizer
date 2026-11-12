# MVP scope and consent boundary

## Accepted defaults

- Manual trigger only.
- Rewrite the whole current prompt; do not autocomplete the next token.
- Return the refined prompt as one clean, professional paragraph with correct grammar; preserve the core task, intent, and important context.
- Show an editable preview; preserve the original until explicit acceptance.
- Never submit a host-site message automatically.
- Run no daemon for terminal refinement; start and stop the browser service explicitly.
- Use hosted Groq inference; do not load a local model.

## Data boundary

The user action authorizes transmission of only the current prompt plus optional, explicitly selected bounded context and constraints. It does not authorize terminal interception, clipboard monitoring, directory crawling, full-page scanning, full-thread collection, background inference, prompt logging, or use of the prompt as an instruction to execute tools.

The Chrome extension must disclose that selected text is sent to Groq. Live mode, if implemented in Phase 4, is a separate opt-in and remains preview-only.

## MVP non-goals

No fine-tuning, RAG, local inference, database, telemetry service, account sync, automatic execution, broad browser support, menu-bar application, login item, or provider/plugin framework beyond the single interface required to isolate Groq.

## Phase gates

Each phase follows `PLAN.md`. A task is checked only after direct verification. Live-provider quality and latency claims require a configured key and actual samples; target-device resource claims require reproduction on an 8 GB Mac mini.

