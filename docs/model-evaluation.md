# Groq model evaluation — Phase 0

Evaluated 2026-11-12 through the authenticated Groq Models and Chat Completions APIs. The key was sourced from the ignored `.env` file and was never printed, copied into a request body, or written to this report.

## Required refinement instruction

> Refine the following prompt into a clean and well-structured format. Keep it in paragraph form and do not change the core task or intent. You may improve clarity and focus, but do not remove important context. Ensure the grammar is correct and the wording is professional and easy to understand.

The evaluator adds preservation, `keep`, untrusted-input, and strict JSON-contract rules. Every request used temperature `0.2`, `max_completion_tokens: 192`, strict JSON Schema, low reasoning effort, and hidden reasoning. Output validation requires one nonempty paragraph with no headings, bullets, or line breaks.

## Authenticated availability

The account exposed these relevant general text models:

| Model | Groq status | Evaluation role |
|---|---|---|
| `openai/gpt-oss-20b` | Production | Candidate |
| `openai/gpt-oss-120b` | Production | Candidate |
| `qwen/qwen3.8-27b` | Preview | Non-production comparator |
| `qwen/qwen3.6-27b` | API-listed, not in the current production table | Excluded from MVP selection |

The authenticated inventory did not expose `llama-3.1-8b-instant` or `llama-3.3-70b-versatile`, so they are not usable candidates for this account. Groq's current documentation identifies GPT-OSS 20B and 120B as production models and Qwen 3.8 27B as preview: <https://console.groq.com/docs/models>.

## Fixed-case comparison

Ten cases were selected before execution: clear/no-op, grammar, coding constraint, UI constraint, multiple constraints, ambiguous input, context use, prompt injection, Vietnamese, and exact Unicode names/identifiers. The same cases and parameters were used for each model.

| Model | API success | Expected decision | Paragraph format among successes | Manual full pass | Request latency, median / max |
|---|---:|---:|---:|---:|---:|
| GPT-OSS 20B | 9/10 | 6/10 | 9/9 | 5/10 | ~350 / 534 ms |
| GPT-OSS 120B | 10/10 | 8/10 | 10/10 | 8/10 | ~511 / 1,790 ms |
| Qwen 3.8 27B preview | 10/10 | 7/10 | 10/10 | 6/10 | ~297 / 406 ms |

Manual full pass required the expected `keep`/`refine` decision, one-paragraph format, preservation of every explicit constraint/name, no unsupported additions, and a complete useful result.

### Material failures

- GPT-OSS 20B produced one `json_validate_failed` response, incorrectly rewrote an underspecified prompt, kept two improvable prompts, and removed the explicit “do not change valid checkout behavior” constraint from one coding result.
- GPT-OSS 120B safely kept rather than refined the prompt-injection case and the Vietnamese case. These are quality misses, not unsafe execution.
- Qwen 3.8 27B kept three improvable cases. Its multi-constraint output was valid JSON but ended mid-sentence at the 192-token cap, making it a semantic failure despite passing the structural paragraph check.

## Decision

Use `openai/gpt-oss-120b` as the provisional MVP default because it had the best intent/constraint preservation and no provider errors in this sample. Keep `openai/gpt-oss-20b` configurable as a lower-cost, lower-latency alternative, not an automatic retry fallback. Do not default to Qwen 3.8 27B because it is preview-only and failed completeness at the fixed cap.

This is a 10-case engineering screen, not the Phase 5 quality gate. GPT-OSS 120B achieved 8/10 here, below the final `>=98%` intent-preservation target. Selection remains provisional until the human-reviewed 100-case held-out evaluation is complete.

## Reproduction

```bash
set -a; . ./.env; set +a
go run ./scripts/evaluate-groq/main.go
go run ./scripts/evaluate-groq/main.go -models qwen/qwen3.8-27b
```

The evaluator prints case IDs, results, token counts, and latency to stdout for manual review. It never prints inputs or credentials and does not write raw prompts or completions to disk.

Groq documents strict structured output support for all three evaluated models and requires reasoning to be parsed or hidden with JSON mode: <https://console.groq.com/docs/structured-outputs>, <https://console.groq.com/docs/reasoning>.

