---
description: Check out an open Dependabot PR, make CI green, push the fix
---

Fix the oldest open Dependabot PR in this repo, or PR #$ARGUMENTS if a number was given.

## Steps

1. List candidates: `gh pr list --author app/dependabot --state open --json number,title,createdAt`.
   If none are open, say so and stop.
2. Pick the target: the argument if provided, otherwise the oldest by `createdAt`.
3. `gh pr checkout <number>`, then `pnpm install --frozen-lockfile`.
   If the lockfile is out of sync, run `pnpm install` and include the updated
   `pnpm-lock.yaml` in the fix commit.
4. Establish the baseline with `make verify` (typecheck, formatting, build, manifest assertion and E2E).
   Install Chrome first if needed: `pnpm -C apps/chrome-extension exec puppeteer browsers install chrome`.
5. If everything already passes, do not push. Comment on the PR that CI is green and stop.
6. Otherwise fix the source, config, or tests so the new dependency version works.
   Constraints:
   - Never downgrade the dependency Dependabot bumped — that defeats the PR.
   - Never weaken a test to make it pass. Adapt it to the new API, or if the behaviour
     genuinely changed, say so and stop for human review.
   - Follow `.claude/rules/coding-conventions.md`.
   - Touch only what the upgrade requires. No drive-by refactors.
7. Re-run every command from step 4 until green. Then `pnpm run format`.
8. Commit with a `fix(deps):` or `test(deps):` prefix describing the adaptation, not the bump.
   Push to the same branch — never force-push, never open a second PR.
9. Comment on the PR summarising what broke, what you changed, and which checks now pass.
   Then report the same summary and stop.

## Never

Merge the PR, close the PR, or approve it. Review and merge are the maintainer's call.
