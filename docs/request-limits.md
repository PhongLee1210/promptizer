# Request and output limits

These are the Phase 1 acceptance rules. They are documented now but are not enforced until the production refiner is implemented.

## Before any browser provider request

1. Trim leading and trailing Unicode whitespace.
2. Reject empty text or fewer than 8 Unicode characters as `INVALID_INPUT`; do not call the provider.
3. Reject a prompt over 4,000 UTF-8 bytes; never truncate the user's current prompt.
4. Limit context to 2,000 UTF-8 bytes and constraints to eight entries of 200 bytes each.
5. Limit the complete local JSON request body to 8 KiB.
6. Keep intended model input near 1,024 tokens. Trim optional context before the current prompt; never make an extra provider call to count tokens.

Live mode has a stricter local trigger: at least 20 trimmed Unicode characters and three whitespace-delimited words, followed by the existing debounce, meaningful-change, request-spacing, focus, and visibility checks.

## Groq provider request

- `max_completion_tokens`: 192.
- Non-streaming.
- Temperature: 0.2 when supported.
- One active provider request; at most one pending request.
- Six-second explicit-request timeout.
- No tools, browsing, external retrieval, or automatic execution.

The 192-token field is a generation ceiling, not a guarantee that every token becomes visible text. Reasoning-capable models can consume completion tokens internally. The fixed candidate evaluation therefore uses low hidden reasoning and strict JSON Schema.

## Gemini Nano provider request

- Require `LanguageModel.availability()` to return `available`; background refinement never starts a model download.
- Start the first download only from the explicit settings button and report progress.
- Use the approved refinement instruction as the system prompt and a strict JSON response constraint.
- Use one fresh session per request and always call `destroy()` afterward.
- Cancel after 20 seconds or when the draft changes.
- Check `measureContextUsage()` against the session context window when available.
- The Prompt API does not expose a completion-token ceiling equivalent to Groq's `max_completion_tokens`. The JSON schema caps `refined_prompt` at 4,000 characters, and post-validation separately caps it at 4,000 UTF-8 bytes and one paragraph. Invalid output is discarded or routed to the consented Groq fallback.

## Returned result

Accept only `decision: keep|refine`. The `refined_prompt` must be nonempty, no more than 4,000 UTF-8 bytes, and exactly one paragraph without headings, bullet lists, or line breaks. For `keep`, it must exactly equal the original prompt. Invalid output becomes a recoverable provider error and never replaces the user's draft.

## Required tests

- Inputs of 0–7 Unicode characters result in `INVALID_INPUT` and zero provider calls.
- An 8-character input can reach the fake provider.
- Every byte/count boundary has exact-limit and one-over-limit cases.
- The outbound payload always sets `max_completion_tokens` to 192.
- A 4,001-byte decoded result, multiline result, bullet list, or invalid `keep` result is rejected.
- Cancellation, timeout, concurrency, and cache paths do not bypass validation.
