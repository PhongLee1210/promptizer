# Promptizer MVP — loop status ledger

Driven by `/mvp-loop` (`.claude/commands/mvp-loop.md`), every 2 hours. States: READY · IN-PROGRESS · NEEDS-REVIEW · VERIFIED · FAILED · BLOCKED-DECISION · PENDING (deps not met) · DONE (verified before loops started) · NEEDS-MANUAL (automated part green; owner check left) · NEEDS-SUPABASE (static review PASS; Supabase-backed node/e2e suites must run before VERIFIED).

## Next loop

1. If `docs/superpowers/decisions/T-3.0.1.md` has `APPROVED:` filled, build `mvp/T-3.0.1-pack-shape` per the chosen option (B: migration + shared `Pack` types + category→pack rename; D: plan amendment + `category.updated_at` / body-length migration). Migrations are written as files only; the owner applies them. Then start Epic 4 (T-4.1.1) stacked on it.
2. If `T-3.1.1.md` is approved (A), tick T-3.1.1 and T-3.1.2 boxes in the plan.
3. Probe Supabase first: `curl -s -o /dev/null -w '%{http_code}' "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health" -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"`. If it answers (not 000/proxy 403), run `pnpm -C apps/web test` and `pnpm -C apps/web run test:e2e` once on `main` and on PRs #9/#10, then promote NEEDS-SUPABASE rows to VERIFIED and tick their plan boxes.
4. If the owner wants progress without Supabase: F-9 (e2e for prompts error boundary, on PR #10's branch) and a root `global-error.tsx` (F-2 remainder). F-6 needs a test seam because `renderMarkdown` never throws on real input; propose one rather than adding a test dependency.

Cloud E2E recipe (extension): run per app, not through turbo (turbo strips env): `cd apps/chrome-extension && CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium xvfb-run -a pnpm run test`. Green on `main` abf75d2 in loop 1.

## Open findings

- **F-1 · high · blocker (owner)** — Loop 2: Supabase env vars are now set, but the cloud network policy blocks the Supabase host (egress proxy 403, `curl` → 000), so auth/prompts suites fail with 502 / cancelled. Fix: allow `*.supabase.co` in the cloud environment network policy. Originally: no Supabase env vars, so `apps/web` Supabase node suites (prompts API, ownership, accounts) and `e2e/run.mjs` never run. Epic 3 endpoint/page tasks cannot reach VERIFIED. Fix: add the `apps/web/.env.example` vars as cloud environment secrets, or run both suites locally and record the result here.
- **F-2 · medium · T-3.2.4** — No `error.tsx`; failed list/prompt loads hit Next's default error page (dead end). Fix PR #10 VERIFIED by owner 2026-11-28 (local `make verify` green, web tests 76/76); awaiting merge. Remaining: no `global-error.tsx` / root `error.tsx`, so `/`, `/m`, `/account/password`, `/sign-in`, `/sign-up` still hit Next's default error page.
- **F-3 · low · T-3.4.3** — Delete e2e did not check category list removal or that Cancel keeps the prompt. Fix PR #9 VERIFIED by owner 2026-11-28 (local `pnpm -C apps/web run test:e2e` all passed with real Supabase); awaiting merge.
- **F-4 · low · T-3.3.2 · product** — Browser back/forward from the editor is not warned, only flushed via keepalive. Decide whether that meets "warns once".
- **F-5 · low · T-3.2.2 · product** — Cards show `updated` time; created date only as a tooltip. Decide if "timestamps" needs both visible.
- **F-6 · low · T-3.1.2** — Render-failure inline alert (`markdown-preview.tsx` error boundary) has no test.
- **F-7 · low · T-3.0.1** — Text limit (20 000 code points) is app-only; `prompt_version.body` has no DB check. Folded into the T-3.0.1 decision.
- **F-9 · medium · T-3.2.4** — PR #10 adds no e2e coverage for the error boundary (failed load shows Try again / Go to all prompts, retry recovers, missing prompt still 404). Also low: `error` prop/digest unused; error screen replaces the app shell.
- **F-8 · NEEDS-MANUAL · T-1.1.7** — Journey A smoke with the unpacked build (chip appears, one real Nano rewrite). Cloud cannot run it.

Proposed Serena memory edit (apply to `web_prompts` once PR #10 merges): "Load failures under prompts are caught by error.tsx in both trees (shared components/prompts-error-state.tsx). Retry does router.refresh()+reset() in startTransition, since reset() alone doesn't re-fetch the server page. error.tsx keeps notFound() 404 status; loading.tsx does not."

## Tasks

| Task | Title | Type | ⇉ | State | Branch | Base | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-1.1.1 | Workspace layout & orchestration decision | decision |  | DONE | | | |
| T-1.1.2 | Scaffold the workspace root | infra |  | DONE | | | |
| T-1.1.3 | Move the extension into its app slot | infra |  | DONE | | | |
| T-1.1.4 | Shared-definitions package shell | infra | ⇉ | DONE | | | |
| T-1.1.5 | Contributor docs point at the new layout | docs | ⇉ | DONE | | | |
| T-1.1.6 | Remove stale artifacts | debt | ⇉ | DONE | | | |
| T-1.1.7 | Full workspace verify pass | qa |  | NEEDS-MANUAL |  |  |  |
| T-2.0.1 | Backend stack & skeleton decision | decision |  | DONE | | | |
| T-2.0.2 | Backend app scaffold in the workspace | infra |  | DONE | | | |
| T-2.0.3 | Account persistence decision | decision |  | DONE | | | |
| T-2.0.4 | Persistence foundation | infra |  | DONE | | | |
| T-2.1.1 | Credential hashing & verification | feat |  | DONE | | | |
| T-2.1.2 | Registration endpoint | feat |  | DONE | | | |
| T-2.1.3 | Sign-up page | feat | ⇉ | DONE | | | |
| T-2.1.4 | Registration tests | test | ⇉ | DONE | | | |
| T-2.2.1 | Dashboard session approach decision | decision |  | DONE | | | |
| T-2.2.2 | Sign-in & sign-out endpoints | feat |  | DONE | | | |
| T-2.2.3 | Session expiry behavior | feat |  | DONE | | | |
| T-2.2.4 | Route guard with return-to | feat |  | DONE | | | |
| T-2.2.5 | Sign-in page UI | feat | ⇉ | DONE | | | |
| T-2.2.6 | Session tests | test | ⇉ | DONE | | | |
| T-2.3.1 | Change-password endpoint | feat |  | DONE | | | |
| T-2.3.2 | Change-password page | feat | ⇉ | DONE | | | |
| T-2.3.3 | Change-password tests | test | ⇉ | DONE | | | |
| T-2.4.1 | Extension credential flow decision | decision |  | DONE | | | |
| T-2.4.2 | Extension auth client | feat |  | DONE | | | |
| T-2.4.3 | Credential persistence & renewal | feat |  | DONE | | | |
| T-2.4.4 | Account screen in the popup | feat | ⇉ | DONE | | | |
| T-2.4.5 | Extension auth tests | test |  | DONE | | | |
| T-3.0.1 | Prompt & pack data-shape decision | decision |  | BLOCKED-DECISION |  |  | decisions/T-3.0.1.md |
| T-3.0.2 | Prompt persistence, owner-scoped | infra |  | NEEDS-SUPABASE | main |  |  |
| T-3.1.1 | Markdown rendering & sanitization decision | decision |  | BLOCKED-DECISION |  |  | decisions/T-3.1.1.md |
| T-3.1.2 | Markdown preview helper | feat |  | NEEDS-SUPABASE | main |  | blocked by T-3.1.1 approval |
| T-3.1.3 | Create-prompt endpoint | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.1.4 | New-prompt page | feat | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.1.5 | Prompt view page | feat | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.1.6 | Ownership isolation tests | test | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.2.1 | List endpoint | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.2.2 | Prompt list page | feat | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.2.3 | Search & pack filter controls | feat |  | BLOCKED-DECISION | main |  | pack filter = category; re-check after T-3.0.1 |
| T-3.2.4 | Empty & no-result states | feat | ⇉ | VERIFIED | mvp/T-3.2.4-error-boundary | main | #10 |
| T-3.2.5 | List tests | test | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.3.1 | Update endpoint | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.3.2 | Editor page with live preview | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.3.3 | Auto-save client | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.3.4 | Auto-save tests | test | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.4.1 | Delete endpoint | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.4.2 | Delete confirmation flow | feat | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.4.3 | Delete tests | test | ⇉ | VERIFIED | mvp/T-3.4.3-delete-tests | main | #9 |
| T-4.1.1 | Pack persistence & endpoints | feat |  | PENDING | | | |
| T-4.1.2 | Pack management UI | feat | ⇉ | PENDING | | | |
| T-4.1.3 | Pack-deletion preservation tests | test | ⇉ | PENDING | | | |
| T-4.2.1 | Membership endpoints | feat |  | PENDING | | | |
| T-4.2.2 | Membership UI | feat |  | PENDING | | | |
| T-4.2.3 | Membership & count tests | test | ⇉ | PENDING | | | |
| T-4.3.1 | Pack view page | feat |  | PENDING | | | |
| T-4.3.2 | Navigation orientation pass | feat |  | PENDING | | | |
| T-5.1.1 | Snapshot & cache decision | decision |  | PENDING | | | |
| T-5.1.2 | Library snapshot endpoint | feat |  | PENDING | | | |
| T-5.1.3 | Extension cache layer | feat |  | PENDING | | | |
| T-5.1.4 | Refresh flow | feat |  | PENDING | | | |
| T-5.1.5 | Sync status display | feat | ⇉ | PENDING | | | |
| T-5.1.6 | Sync tests | test | ⇉ | PENDING | | | |
| T-5.2.1 | Rail "My Prompts" item | feat |  | PENDING | | | |
| T-5.2.2 | Picker UI | feat |  | PENDING | | | |
| T-5.2.3 | Insert into preview | feat |  | PENDING | | | |
| T-5.2.4 | Offline read-only behavior | feat |  | PENDING | | | |
| T-5.2.5 | Picker tests | test | ⇉ | PENDING | | | |
| T-5.3.1 | Sign-out wipe | feat |  | PENDING | | | |
| T-5.3.2 | Wipe tests | test | ⇉ | PENDING | | | |
| T-6.1.1 | Save-prompt endpoint | feat |  | PENDING | | | |
| T-6.1.2 | Rail "Save prompt" action + title step | feat |  | PENDING | | | |
| T-6.1.3 | One-time first-save notice | feat | ⇉ | PENDING | | | |
| T-6.1.4 | Save flow tests | test | ⇉ | PENDING | | | |
| T-6.2.1 | Edit push from the extension | feat |  | PENDING | | | |
| T-6.2.2 | Edit UI in the picker | feat |  | PENDING | | | |
| T-6.2.3 | Edit sync tests | test | ⇉ | PENDING | | | |
| T-6.3.1 | Conflict detection decision | decision |  | PENDING | | | |
| T-6.3.2 | Conflict refusal & "updated elsewhere" UI | feat |  | PENDING | | | |
| T-6.3.3 | Network error retry states | feat |  | PENDING | | | |
| T-6.3.4 | Offline save disabled state | feat | ⇉ | PENDING | | | |
| T-6.3.5 | Conflict & error tests | test | ⇉ | PENDING | | | |
| T-7.1.1 | Journey A regression pass | qa |  | PENDING | | | |
| T-7.1.2 | Journey B end-to-end pass | qa |  | PENDING | | | |
| T-7.1.3 | Journeys C & D pass | qa | ⇉ | PENDING | | | |
| T-7.2.1 | Privacy principles verification | qa |  | PENDING | | | |
| T-7.2.2 | Documentation update | docs | ⇉ | PENDING | | | |
| T-7.2.3 | Permission-change explanation | docs | ⇉ | PENDING | | | |
| T-7.3.1 | Service deployment & smoke test | infra |  | PENDING | | | |
| T-7.3.2 | Extension version bump & release | feat |  | PENDING | | | |

## Loop log

- 2026-11-27 — ledger created; no loop run yet.
- 2026-11-27 loop 1 (cloud, ~45 min) — `main` abf75d2: typecheck, format, build green; extension unit+E2E green (cloud recipe above); web node tests 50/50 but Supabase suites skipped (F-1). Two fresh verifiers audited Epic 3 on `main`: 75 checkboxes, T-3.0.1 FAIL (no pack entity; packs removed in 94f9045), T-3.1.1 PARTIAL (no decision record), 3 PARTIAL in 3.2.4/3.4.3, rest static PASS. Wrote decisions T-3.0.1 (options A–D, rec. B) and T-3.1.1 (rec. A). Opened draft PRs #9 (T-3.4.3 delete e2e) and #10 (T-3.2.4 error boundaries). Phase 5 sweep skipped: dashboard needs Supabase, no logged-in browser in cloud. Findings F-1–F-8 opened. No plan boxes ticked (nothing VERIFIED).
- 2026-11-27 loop 2 (cloud, ~20 min) — Decisions T-3.0.1 / T-3.1.1 still unapproved; `main` unchanged (abf75d2), extension E2E green again. Supabase env vars now present but host blocked by network policy: web tests 52 pass / 12 fail (Supabase suites only), F-1 updated. Fresh verifier: PR #9 and #10 static PASS (typecheck, prettier, build green, no new test failures) → NEEDS-SUPABASE. Opened F-9; F-2/F-3 notes updated. No new builds (critical path blocked), no plan boxes ticked. Phase 5 sweep skipped (no dashboard backend). Owner notified.
- 2026-11-27 loop 3 (cloud, ~5 min) — No-op. Decisions T-3.0.1 / T-3.1.1 still have empty `APPROVED:`; `main` unchanged (abf75d2, already verified green in loops 1–2); open drafts #9/#10 unchanged, no owner comments; Supabase host still refused by egress proxy (403, F-1). Critical path fully blocked on the owner, and "Next loop" item 4 is gated on owner opt-in, so nothing dispatched. No tasks moved, no PRs opened. Owner not re-notified (same blockers as loop 2).
- 2026-11-28 loop 4 (cloud, ~3 min) — No-op. Decisions T-3.0.1 / T-3.1.1 still have empty `APPROVED:`; `main` unchanged (abf75d2); drafts #9/#10 unchanged since 2026-11-27, no owner comments; Supabase host still refused by egress proxy (403, F-1). Nothing dispatched; no tasks moved, no PRs opened. Owner not re-notified (same blockers as loop 2).
- 2026-11-28 loop 5 (cloud, ~3 min) — No-op. Decisions T-3.0.1 / T-3.1.1 still have empty `APPROVED:`; `main` unchanged (abf75d2); drafts #9/#10 unchanged since 2026-11-27, no owner comments; Supabase health probe still 000 (F-1). Nothing dispatched; no tasks moved, no PRs opened. Owner not re-notified (same blockers as loop 2).
- 2026-11-28 loop 6 (cloud, ~3 min) — No-op. Decisions T-3.0.1 / T-3.1.1 still have empty `APPROVED:`; `main` unchanged (abf75d2); drafts #9/#10 unchanged since 2026-11-27, no owner comments; Supabase health probe still 000 / proxy 403 (F-1). Nothing dispatched; no tasks moved, no PRs opened. Owner not re-notified (same blockers as loop 2).
- 2026-11-28 — owner verified PR #10 locally (comment on #10): T-3.2.4 → VERIFIED, plan boxes ticked.
- 2026-11-28 — owner verified PR #9 locally with real Supabase e2e (comment on #9): T-3.4.3 → VERIFIED, plan boxes ticked.
