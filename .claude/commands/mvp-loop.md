---
description: One 2-hour MVP build loop — review last loop, dispatch sub-agents on the next unblocked tasks as stacked draft PRs, verify, record.
---

# MVP loop (one iteration, hard budget 2h)

Plan: `docs/superpowers/plans/2026-11-24-promptizer-mvp-task-breakdown.md` (task blocks, `after:` deps, ⇉ markers).
Parent journeys: `docs/superpowers/plans/2026-11-24-promptizer-mvp.md`.
Ledger (single source of loop state): `docs/superpowers/plans/2026-11-27-mvp-loop-status.md`.
`docs/superpowers/` is gitignored, so worktrees do not contain these files: always read and write them by absolute path in the main checkout (`$(git rev-parse --show-toplevel)` of the primary worktree), and pass that path to sub-agents.
Record `LOOP_START=$(date +%s)` first. Stop dispatching new work at 95 min; spend the rest verifying and recording.

## Cloud mode

Applies when the run is a cloud scheduled task (fresh checkout, no local machine). It overrides the rules below where they conflict.

- Loop state lives on branch `mvp/loop-state`, not on `main`. Start with `git fetch origin && git checkout mvp/loop-state && git pull --ff-only`. `docs/superpowers/` is tracked there, so read and write it in the checkout, not by absolute path.
- Serena MCP is unavailable: read `.serena/memories/<name>.md` directly for every `mem:` link.
- No Codex jobs; use Claude sub-agents only.
- No logged-in ChatGPT/Claude pages: skip `verify-in-browser` and unpacked-extension manual walks. Use the Puppeteer E2E suites; record the skipped manual checks in the ledger as `NEEDS-MANUAL` for the owner.
- If Supabase env vars are missing, skip the Supabase suites and note it in the loop log instead of failing the loop.
- Task branches still base on `main` or on their stack; never base task work on `mvp/loop-state`.
- Phase 6 ends with: commit ledger, plan and decision changes on `mvp/loop-state` (one-line message), `git push origin mvp/loop-state`. Never push to `main`.

## Hard rules

- Follow `AGENTS.md` (pnpm only, one-line commit messages with no footer, no comments in code, ask-first items, E2E-first).
- Every task = one branch + one **draft** PR. Never merge, never push to `main`, never `gh pr merge`.
- Stacking: branch `mvp/T-x.y.z-<slug>`; base = branch of the task named in its `after:` (or the stack tip of its story), else `main`. `gh pr create --draft --base <base>`. After a lower PR changes, `git rebase --update-refs` the stack and force-push with `--force-with-lease`.
- Decision tasks: write `docs/superpowers/decisions/T-x.y.z.md` (options, recommendation, consequences), mark the task `BLOCKED-DECISION` in the ledger, build nothing that depends on it. The owner approves by writing `APPROVED: <option>` in that file.
- Supabase-backed suites (`pnpm -C apps/web test`, `pnpm -C apps/web run test:e2e`) at most once per 5 min across ALL agents. Serialize them through the orchestrator.
- Never print `.env` or tokens.

## Phase 0 — Orient (≤10 min)

1. Serena: `activate_project`, `read_memory core`, follow the `mem:` links relevant to this loop's tasks.
2. Read the ledger's "Next loop" and "Open findings". `git fetch`; `gh pr list --state open --draft --json number,headRefName,baseRefName,statusCheckRollup`.
3. `make verify` on `main` once. If red, the first job is a fix PR; do nothing else until it is green.

## Phase 1 — Review last loop's PRs (≤25 min)

For each ledger row in `NEEDS-REVIEW`, spawn a **fresh verifier sub-agent** (it must not be the agent that wrote the code). Brief: task block + PR number + verification matrix row below. It checks out the branch, runs the checks, walks the journey in a real browser (`verify-in-browser` skill for ChatGPT/Claude pages; Puppeteer or the built extension for popup/rail; dashboard at `apps/web` dev server), and returns `PASS` or a numbered findings list with repro steps.
- PASS → tick the task's checkboxes in the plan doc, ledger state `VERIFIED`, PR comment with the evidence summary.
- FAIL → spawn a fix sub-agent on the same branch with the findings; re-verify once this loop; if still failing, ledger `FAILED` with findings carried to "Open findings".

## Phase 2 — Select work (≤5 min)

Ready = every `after:` task is `VERIFIED` (or already `[x]` in the plan) and no open decision blocks it. Take as many as fit before minute 95, critical-path first (E3 → E4 → E5 → E6 → E7, Story 2.4 lane beside it). Group them into:
- **Parallel lane**: ⇉ tasks that touch disjoint files. Each one gets its own git worktree (`git worktree add ../pz-wt/T-x.y.z -b mvp/T-x.y.z-<slug> <base>`). Max 3 Claude sub-agents + 2 Codex jobs at once.
- **Sequential lane**: dependent tasks, built bottom-up on the stack.

## Phase 3 — Dispatch

Sub-agent brief (pass all of it; sub-agents start cold):
```
Task: <full task block from the plan, verbatim>
Journey: <the parent-plan journey steps this task serves>
Branch/base/worktree: <...>
Read first: Serena mem:core + <specific mem: links>; AGENTS.md
Done = every checkbox in the task block, proven by: <verification matrix row>
Before finishing: make verify (Supabase suites: request a slot from the orchestrator, do not run directly), self-review the diff, commit (one line), push, open the draft PR with base <base> and a body listing each checkbox → evidence.
If you learn a stable, non-obvious convention, return it as a proposed Serena memory edit (do not write it yourself).
Return: PR URL, checkbox→evidence table, commands run with results, proposed memory edits, open risks.
```
Codex jobs (only self-contained ⇉ tasks with no Supabase dependence): `codex exec --full-auto --cd ../pz-wt/T-x.y.z "<same brief>"`. Review a Codex result with a Claude verifier before it can reach `VERIFIED`; Codex output is never self-certified.

## Phase 4 — Verify this loop's output

Same as Phase 1 for each new PR whose builder reported done, if time allows; otherwise leave it `NEEDS-REVIEW` for the next loop.

### Verification matrix (automate where listed)

| Area | Automated | Journey / manual check |
| --- | --- | --- |
| Extension chip & rail (content script) | `make verify` E2E Puppeteer journeys; `extension-analyze` for MV3/CSP/permissions | chip appears on ChatGPT + Claude composers, never steals focus, no typing lag, preview editable, nothing auto-submits |
| Extension popup / account | `apps/chrome-extension/e2e/tests/account.mjs` | sign-in, sign-out wipe, offline state |
| Web dashboard | `pnpm -C apps/web test`, `test:e2e`, typecheck | create→list→search→edit (auto-save)→delete; mobile + desktop route trees |
| Sync extension ↔ web (E5/E6) | sync/picker/save/conflict E2E per task | save from rail → appears on dashboard; edit on web → refresh in picker; conflict shows "updated elsewhere"; offline read-only |
| UX quality (web + chip) | screenshot diffs where suites support it | `frontend-design`/`extension-ui` review: spacing, focus order, empty/error/loading states, keyboard + a11y, copy consistency |

## Phase 5 — UX & bug sweep (every loop, ≥15 min, one sub-agent)

A fresh sub-agent builds `main` + the stack tip, loads `apps/chrome-extension/.output/chrome-mv3/` unpacked, and walks Journeys A–D end to end (whatever exists so far), plus the web dashboard on desktop and mobile widths. It files findings into the ledger's "Open findings" as `F-<n>` with severity, repro, and the suggested owning task; UX friction counts as a finding. High-severity findings become fix tasks at the top of the next loop.

## Phase 6 — Record (≤10 min, always runs)

1. Ledger: update every task row's state (`READY`, `IN-PROGRESS`, `NEEDS-REVIEW`, `VERIFIED`, `FAILED`, `BLOCKED-DECISION`), PR number, branch, base; add a loop log entry (time used, tasks moved, findings opened/closed); rewrite "Next loop".
2. Plan doc: tick only `VERIFIED` checkboxes; update the epic `**Status (date):**` line.
3. Serena: apply proposed memory edits that pass `mem:memory_maintenance` (stable conventions only; never status, plans or progress — those live in the ledger).
4. `git worktree prune`. Print a ≤10-line summary: moved tasks, PRs opened, blockers needing the owner.
