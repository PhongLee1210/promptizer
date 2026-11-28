# Promptizer MVP — loop status ledger

Driven by `/mvp-loop` (`.claude/commands/mvp-loop.md`), every 2 hours. States: READY · IN-PROGRESS · NEEDS-REVIEW · VERIFIED · FAILED · BLOCKED-DECISION · PENDING (deps not met) · DONE (verified before loops started) · NEEDS-MANUAL (automated part green; owner check left) · NEEDS-SUPABASE (static review PASS; Supabase-backed node/e2e suites must run before VERIFIED).

## Next loop

1. **Owner decisions.**
   - `decisions/T-6.3.1.md` (conflict rule; rec. A) now blocks T-6.3.2 and T-6.3.5.
   - `decisions/T-6.1.2.md`: the owner built option A in #37 ("checked in with the owner"). Write `APPROVED: A` so the file matches.
   - `decisions/T-2.4.3-token-reach.md`: now also covers F-18 (two in-memory session managers, popup and worker).
   - `T-3.0.1.md` and `T-3.1.1.md` are still blank, though the owner's PRs treat both as A.
2. **Review.** Fresh-verify #40 (F-17 fix), #41 (T-6.3.4) and #42 (T-6.2.1) if the loop 15 verifier result below isn't PASS for all three. On PASS, move T-6.1.2, T-6.1.3, T-6.3.4 and T-6.2.1 to VERIFIED and tick their boxes. T-5.2.4 box 2 is satisfied by #41.
3. **Build next, stacked on #42 (`mvp/T-6.2.1-edit-push`):**
   - T-6.2.2 (picker edit/delete UI; show `fields` validation errors inline, closing T-6.2.1 box 3; reuse `OFFLINE_SAVE_MESSAGE` + the `navigator.onLine` gate from #41; delete needs a `DELETE` relay through the worker like `promptizer:update-prompt`).
   - Then T-6.3.3 (retry states, after T-6.2.1 only).
   - Then T-6.2.3.
4. **F-18 (medium):** worker vs popup renewal guards. It needs an owner call before a fix.
5. **Stack (bottom → top):** main ← #11 ← #13 ← #14 ← #15 ← #16 ← #17 ← #18 ← #19 ← #20 ← #21 ← #22 ← #23 ← #24 ← #25 ← #26 ← #28 ← #29 ← #31 ← #32 ← #37 ← #38 ← #39 ← #40 ← #41 ← #42.
   - #33 (F-15) also sits on #32, in parallel with #37. Whichever merges second needs a small rebase in `session-manager.ts` / `account-session.ts`.
   - Off `main`: #9, #10 (← #12), #27, #30, #34 ← #35 ← #36.
6. **Supabase is still unreachable from cloud (F-1).**

Cloud E2E recipe (extension): run per app, not through turbo (turbo strips env): `cd apps/chrome-extension && CI=1 PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium xvfb-run -a pnpm run test`. A single suite: copy `e2e/shim/e2e-fake-nano.content.ts` to `src/entrypoints/`, `pnpm build`, `xvfb-run -a node e2e/tests/<suite>.mjs`, then delete the shim copy and rebuild. Kill stale node/chromium if port 4173 is busy.

## Open findings

- **F-1 · high · blocker (owner)** — Loop 2: Supabase env vars are now set, but the cloud network policy blocks the Supabase host (egress proxy 403, `curl` → 000), so auth/prompts suites fail with 502 / cancelled. Fix: allow `*.supabase.co` in the cloud environment network policy. Originally: no Supabase env vars, so `apps/web` Supabase node suites (prompts API, ownership, accounts) and `e2e/run.mjs` never run. Epic 3 endpoint/page tasks cannot reach VERIFIED. Fix: add the `apps/web/.env.example` vars as cloud environment secrets, or run both suites locally and record the result here.
- **F-2 · medium · T-3.2.4 · VERIFIED loop 10** — #12 fresh verifier PASS (typecheck, prettier, build without Supabase, `next start` runtime check of root `error.tsx` and `global-error.tsx`). Optional polish: `global-error.tsx` lacks theme boot/Inter font; sign-in "Go to all prompts" round-trips to sign-in. Loop 7: remainder fixed in draft PR #12 (stacked on #10): root `error.tsx` + `global-error.tsx`, static green and runtime-checked in `next dev`. Original: No `error.tsx`; failed list/prompt loads hit Next's default error page (dead end). Fix PR #10 VERIFIED by owner 2026-11-28 (local `make verify` green, web tests 76/76); awaiting merge. Remaining: no `global-error.tsx` / root `error.tsx`, so `/`, `/m`, `/account/password`, `/sign-in`, `/sign-up` still hit Next's default error page.
- **F-3 · low · T-3.4.3** — Delete e2e did not check category list removal or that Cancel keeps the prompt. Fix PR #9 VERIFIED by owner 2026-11-28 (local `pnpm -C apps/web run test:e2e` all passed with real Supabase); awaiting merge. Nit: `check("cancel returns to the prompt", true)` at run.mjs:1110 is vacuous; fold into the new check.
- **F-4 · low · T-3.3.2 · product** — Browser back/forward from the editor is not warned, only flushed via keepalive. Decide whether that meets "warns once".
- **F-5 · low · T-3.2.2 · product** — Cards show `updated` time; created date only as a tooltip. Decide if "timestamps" needs both visible.
- **F-6 · low · T-3.1.2** — Render-failure inline alert (`markdown-preview.tsx` error boundary) has no test.
- **F-7 · low · T-3.0.1** — Text limit (20 000 code points) is app-only; `prompt_version.body` has no DB check. Folded into the T-3.0.1 decision.
- **F-9 · medium · T-3.2.4** — PR #10 adds no e2e coverage for the error boundary (failed load shows Try again / Go to all prompts, retry recovers, missing prompt still 404). Also low: `error` prop/digest unused; error screen replaces the app shell.
- **F-10 · medium · Journey A (pre-existing on `main`) · VERIFIED loop 9** — After any result, `pendingEditor` stayed pinned to that editor, so on a page with two editors the chip never followed focus. Fix: draft PR #27 (base `main`). Loop 9 verifier caught a regression (Replace from a reopened Recent result was a no-op); fixed in 5715553 (`applySuggestion` uses `anchorEditor()`, `history.mjs` check). Re-verify PASS: unit 12/12, E2E 40/40. NEEDS-MANUAL on ChatGPT's edit-message box.
- **F-11 · low · T-5.1.5** — Popup said "1 prompts, 0 packs". Fix: draft PR #31 (stack tip).
- **F-12 · low · docs · VERIFIED loop 9** — README, features.md, architecture.md and CONTRIBUTING.md claimed no network calls after Epic 2 shipped sign-in. Fix: draft PR #30 (T-7.2.3), follow-up b9d11b9. PASS.
- **F-13 · high · T-5.3.1 · VERIFIED loop 9** — A library refresh in flight at sign-out (or during a sign-in as another account) wrote the old library back; loop 9 found the same race in session renewal (credentials and `signedIn` flag written back after sign-out, A's renewal overwriting B). All fixed in #32 (cbc1124, 5c22c9f, a9ebd46): `credentialChangeCount` snapshotted before the session read, bumped before and after a sign-in's writes, renewals dropped while a sign-in is writing. 7 race unit tests with a FIFO delayed store; fresh verifier PASS with 8 interleaving probes.
- **F-14 · medium · T-5.2.1 · partly fixed** — The content script no longer reads the session (separate `promptizer.signedIn` flag; picker dismissed on sign-out, both in #32). Remainder: tokens still reach content-script `storage.onChanged` listeners because session and flag share one `storage.local.set`, and `storage.local` can't be locked to trusted contexts. Owner decision: `decisions/T-2.4.3-token-reach.md` (rec. A).
- **F-15 · low · T-2.4.3 (pre-existing) · VERIFIED loop 10** — Fixed in draft PR #33 (stacked on #32): renewals shared per refresh token. Fresh verifier PASS: unit 35/35, E2E 75/75, 3 race probes. Residual (low): (a) a `store.load()` delayed past settle+cleanup could still start a second renewal with the old token (not reachable with ordered `storage.local`); (b) the map is per JS context (two popups renew separately); (c) a dropped renewal still returns `ok`, never `retryable`. Original: Two concurrent renewals of the same refresh token: if the second is rejected (refresh-token reuse), it clears the session the first just saved. Fix: share one in-flight renewal in `session-manager.ts`. Also low: a dropped renewal returns `ok` with whatever is stored, never `retryable`.
- **F-16 · info · release (T-7.3.2) · assert half VERIFIED loop 11** — Exact `["activeTab","storage"]` assert in draft PR #34 (base `main`): loop 11 fresh verifier PASS (9 drift probes, unit 12/12, E2E 37/37, assert wired into build/zip/CI/release). The verifier found that `optional_permissions` / `optional_host_permissions` were unchecked; fixed in draft PR #35 (base #34), loop 12 fresh verifier PASS (13 probes, unit 12/12, E2E 37/37). The no-message low note is fixed in draft PR #36 (base #35), loop 13 fresh verifier PASS (17 probes, unit 12/12, E2E 37/37); nit fixed loop 14 in 1e7da52 on #36, loop 15 fresh verifier PASS (6 probes). Low leftover: `2>/dev/null` reports any jq failure (even jq missing) as "not valid JSON". Remaining: `WXT_API_ORIGIN` for release. Original: `API_ORIGIN` falls back to `http://localhost:3000`; the release build must set `WXT_API_ORIGIN` to the production HTTPS origin. Also `assert-manifest.sh` only asserts empty `host_permissions` and no `offscreen`, not the exact `storage`/`activeTab` list the docs say is "asserted on every build".
- **F-17 · high · T-6.1.2/T-6.1.3 · fix NEEDS-REVIEW** — Loop 15 verifier (reproduced): a save finishing after sign-out wrote `promptizer.librarySnapshot` and `promptizer.firstSaveNoticeShown` back into storage (content-script cache merge had no guard). Also medium: a save with no synced cache stamped `fetchedAt: now`, hiding the rest of the library for 15 min. Fix: draft #40 (base #39), signed-in change counter + storage re-check before and after the writes, `fetchedAt: 0` when unsynced; new E2E checks fail without the fix (11/13), pass with it.
- **F-18 · medium · T-6.1.2 / T-2.4.3 · owner** — `entrypoints/background.ts` builds a second `accountSession`; its in-memory `credentialChangeCount` and shared-renewal map can't see the popup's. A worker renewal overlapping a sign-out can write the session back; popup + worker renewing the same refresh token at once can sign the user out (reuse rejection → `clearCredentials`). Reasoned from code, not reproduced. Needs a storage-level guard (e.g. renew only in the worker, popup asks it via message). Decide alongside `decisions/T-2.4.3-token-reach.md`.
- **F-19 · low · T-6.1.2/T-6.1.4** — Save step's top-bar Close stays enabled while the request is in flight; #39's "surfaces the server's error message" check asserts the generic retryable text; no checks for the Cancel button, "never again" after the first notice, or the flag wipe on sign-out.
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
| T-2.4.3 | Credential persistence & renewal | feat |  | DONE | mvp/T-2.4.3-shared-renewal | mvp/T-5.3.1-wipe-race | F-15 fix #33 (VERIFIED loop 10); token-reach decision pending |
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
| T-3.2.4 | Empty & no-result states | feat | ⇉ | VERIFIED | mvp/T-3.2.4-error-boundary | main | #10; F-2 follow-up #12 (VERIFIED loop 10, base #10) |
| T-3.2.5 | List tests | test | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.3.1 | Update endpoint | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.3.2 | Editor page with live preview | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.3.3 | Auto-save client | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.3.4 | Auto-save tests | test | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.4.1 | Delete endpoint | feat |  | NEEDS-SUPABASE | main |  |  |
| T-3.4.2 | Delete confirmation flow | feat | ⇉ | NEEDS-SUPABASE | main |  |  |
| T-3.4.3 | Delete tests | test | ⇉ | VERIFIED | mvp/T-3.4.3-delete-tests | main | #9 |
| T-4.1.1 | Pack persistence & endpoints | feat |  | NEEDS-SUPABASE | mvp/T-4.1.1-pack-endpoints | main | #11 (owner-built; owner reports 82/82 live; cloud static PASS) |
| T-4.1.2 | Pack management UI | feat | ⇉ | NEEDS-SUPABASE | mvp/T-4.1.2-pack-ui | mvp/T-4.1.1-pack-endpoints | #13 (owner-built; owner reports web tests + e2e green live) |
| T-4.1.3 | Pack-deletion preservation tests | test | ⇉ | NEEDS-SUPABASE | | | no own PR: owner reports covered by #11 preservation tests + #13 packJourney; not separately verified |
| T-4.2.1 | Membership endpoints | feat |  | NEEDS-SUPABASE | | | no own PR: owner reports satisfied by existing `PATCH categoryId` under single-pack (T-3.0.1 A) |
| T-4.2.2 | Membership UI | feat |  | NEEDS-SUPABASE | mvp/T-4.2.2-pack-membership-ui | mvp/T-4.3.1-pack-view | #15 (owner-built) |
| T-4.2.3 | Membership & count tests | test | ⇉ | NEEDS-SUPABASE | mvp/T-4.2.2-pack-membership-ui | | covered inside #15 (owner) |
| T-4.3.1 | Pack view page | feat |  | NEEDS-SUPABASE | mvp/T-4.3.1-pack-view | mvp/T-4.1.2-pack-ui | #14 (owner-built) |
| T-4.3.2 | Navigation orientation pass | feat |  | NEEDS-SUPABASE | mvp/T-4.3.2-nav-orientation | mvp/T-4.2.2-pack-membership-ui | #16 (owner-built; sidebar pack counts deferred by owner) |
| T-5.1.1 | Snapshot & cache decision | decision |  | DONE | | | owner-approved option A per #17/#18 bodies; no decision file on loop-state |
| T-5.1.2 | Library snapshot endpoint | feat |  | NEEDS-SUPABASE | mvp/T-5.1.2-snapshot-endpoint | mvp/T-4.3.2-nav-orientation | #17 (owner-built; owner reports 85/85 live) |
| T-5.1.3 | Extension cache layer | feat |  | VERIFIED | mvp/T-5.1.3-extension-cache | mvp/T-5.1.2-snapshot-endpoint | #18 (owner-built; cloud unit+E2E green) |
| T-5.1.4 | Refresh flow | feat |  | VERIFIED | mvp/T-5.1.4-refresh-flow | mvp/T-5.1.3-extension-cache | #19 (owner-built; cloud unit+E2E green) |
| T-5.1.5 | Sync status display | feat | ⇉ | NEEDS-MANUAL | mvp/T-5.1.5-sync-status | mvp/T-5.1.4-refresh-flow | #20 (owner-built); plural fix #31 |
| T-5.1.6 | Sync tests | test | ⇉ | VERIFIED | mvp/T-5.1.6-sync-tests | mvp/T-5.3.1-sign-out-wipe | #22 (fresh verifier PASS) |
| T-5.2.1 | Rail "My Prompts" item | feat |  | VERIFIED | mvp/T-5.2.1-rail-my-prompts | mvp/T-5.1.6-sync-tests | #23 (verifier PASS; token-read and picker-on-sign-out fixes in #32); real-site look NEEDS-MANUAL |
| T-5.2.2 | Picker UI | feat |  | VERIFIED | mvp/T-5.2.2-picker-ui | mvp/T-5.2.1-rail-my-prompts | #24 (verifier PASS); real-site look and keyboard NEEDS-MANUAL |
| T-5.2.3 | Insert into preview | feat |  | VERIFIED | mvp/T-5.2.3-insert-into-preview | mvp/T-5.2.2-picker-ui | #25 (verifier PASS) |
| T-5.2.4 | Offline read-only behavior | feat |  | VERIFIED | mvp/T-5.2.4-offline-picker | mvp/T-5.3.2-wipe-tests | #28 (verifier PASS; box 2 moved to T-6.3.4) |
| T-5.2.5 | Picker tests | test | ⇉ | VERIFIED | mvp/T-5.2.5-picker-tests | mvp/T-5.2.4-offline-picker | #29 (verifier PASS) |
| T-5.3.1 | Sign-out wipe | feat |  | VERIFIED | mvp/T-5.3.1-sign-out-wipe | mvp/T-5.1.5-sync-status | #21 + fixes in #32 (library-wipe race, session-renewal race; loop 9 fresh verifier PASS at a9ebd46) |
| T-5.3.2 | Wipe tests | test | ⇉ | VERIFIED | mvp/T-5.3.2-wipe-tests | mvp/T-5.2.3-insert-into-preview | #26 + race tests in #32 (unit 34/34, E2E 75/75; loop 9 PASS) |
| T-6.1.1 | Save-prompt endpoint | feat |  | NEEDS-SUPABASE | main | | no new endpoint: existing `POST /api/prompts` (T-3.1.3) meets all 3 boxes; see decisions/T-6.1.2.md |
| T-6.1.2 | Rail "Save prompt" action + title step | feat |  | NEEDS-REVIEW | mvp/T-6.1.2-save-prompt-rail | mvp/T-5.3.1-wipe-race | #37 (owner-built, option A worker relay); loop 15 verifier: F-17 high race → fix #40 (`mvp/T-6.1.2-save-race`, base #39) |
| T-6.1.3 | One-time first-save notice | feat | ⇉ | NEEDS-REVIEW | mvp/T-6.1.3-first-save-notice | mvp/T-6.1.2-save-prompt-rail | #38 (owner-built); flag-after-sign-out race (F-17) fixed in #40 |
| T-6.1.4 | Save flow tests | test | ⇉ | VERIFIED | mvp/T-6.1.4-save-flow-tests | mvp/T-6.1.3-first-save-notice | #39 (owner-built; loop 15 verifier PASS, low test gaps in F-19) |
| T-6.2.1 | Edit push from the extension | feat |  | NEEDS-REVIEW | mvp/T-6.2.1-edit-push | mvp/T-6.3.4-offline-save | #42 (box 3 data path only; inline display in T-6.2.2) |
| T-6.2.2 | Edit UI in the picker | feat |  | PENDING | | | |
| T-6.2.3 | Edit sync tests | test | ⇉ | PENDING | | | |
| T-6.3.1 | Conflict detection decision | decision |  | BLOCKED-DECISION | | | decisions/T-6.3.1.md |
| T-6.3.2 | Conflict refusal & "updated elsewhere" UI | feat |  | PENDING | | | |
| T-6.3.3 | Network error retry states | feat |  | PENDING | | | |
| T-6.3.4 | Offline save disabled state | feat | ⇉ | NEEDS-REVIEW | mvp/T-6.3.4-offline-save | mvp/T-6.1.2-save-race | #41 (also T-5.2.4 box 2) |
| T-6.3.5 | Conflict & error tests | test | ⇉ | PENDING | | | |
| T-7.1.1 | Journey A regression pass | qa |  | PENDING | mvp/T-7.1.1-release-anchor-editor | main | F-10 fix #27 VERIFIED loop 9 (5715553); the pass itself waits for all epics |
| T-7.1.2 | Journey B end-to-end pass | qa |  | PENDING | | | |
| T-7.1.3 | Journeys C & D pass | qa | ⇉ | PENDING | | | |
| T-7.2.1 | Privacy principles verification | qa |  | PENDING | | | |
| T-7.2.2 | Documentation update | docs | ⇉ | PENDING | | | |
| T-7.2.3 | Permission-change explanation | docs | ⇉ | VERIFIED | mvp/T-7.2.3-network-reach | main | #30 (loop 9 fresh verifier PASS at b9d11b9; store declaration draft in PR body) |
| T-7.3.1 | Service deployment & smoke test | infra |  | PENDING | | | |
| T-7.3.2 | Extension version bump & release | feat |  | PENDING | mvp/T-7.3.2-assert-permissions | main | F-16 assert fix #34 (VERIFIED loop 11), optional-permissions follow-up #35 (VERIFIED loop 12), failure-message follow-up #36 (`mvp/T-7.3.2-assert-messages`, VERIFIED loop 13, nit 1e7da52 VERIFIED loop 15); the release itself waits for all epics |

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
- 2026-11-28 loop 7 (cloud, ~25 min) — Decisions T-3.0.1 / T-3.1.1 still have an empty `APPROVED:`. `main` unchanged (abf75d2). Found owner-built draft PR #11 (T-4.1.1, category-as-pack, the body says T-3.0.1 approved as A). Static review in cloud: typecheck, prettier and build pass; web tests 52/12, same as `main` (the 12 failures are Supabase suites, F-1); code follows the prompt-route patterns (nit: category ids are validated with `isPromptId`) → NEEDS-SUPABASE. Built F-2 remainder: draft PR #12 `mvp/T-3.2.4-global-error` → base #10 (root `error.tsx` + `global-error.tsx`, `PromptsErrorState` takes `description`). Typecheck, prettier and build pass; Playwright check against `next dev` with a temporary throwing page shows the boundary, Try again and the `/prompts` link. T-4.1.2 not started: the decision file is still unapproved. Supabase still proxy 403. Owner notified about the decision-file mismatch.
- 2026-11-28 loop 8 (cloud, ~95 min) — Decision files T-3.0.1 / T-3.1.1 are still unapproved, but the owner built and opened Epic 4–5 drafts #13–#20 overnight (treating T-3.0.1 and T-5.1.1 as A). Cloud checks at stack tip #20: extension typecheck, unit 25/25, E2E green; web typecheck and build pass; web tests fail only in the Supabase suites (F-1, proxy still 403). Reviewed #18/#19 code → T-5.1.3 and T-5.1.4 VERIFIED. Built the rest of Epic 5 as stacked drafts: #21 T-5.3.1, #22 T-5.1.6, #23 T-5.2.1, #24 T-5.2.2 (picker), #25 T-5.2.3, #26 T-5.3.2, #28 T-5.2.4, #29 T-5.2.5, #31 plural fix. Off `main`: #27 F-10 Journey A anchor-editor fix (E2E fails on `main`, passes with fix) and #30 T-7.2.3 docs. A fresh verifier passed 7 of 9; it failed T-5.3.1 and T-5.3.2 on the refresh-after-wipe race. Fixed in #32 with F-13 and F-14 plus 2 low items. Wrote decisions T-6.1.2 (write channel) and T-6.3.1 (conflict rule); Epic 6 is blocked on them. T-6.1.1 is met by the existing `POST /api/prompts`. Plan boxes ticked: T-5.1.3, T-5.1.4, T-5.1.6, T-5.2.1, T-5.2.2, T-5.2.3, T-5.2.4 (boxes 1 and 3), T-5.2.5. All PR CI suites green.
- 2026-11-28 loop 9 (cloud, ~45 min) — Decisions T-3.0.1 / T-3.1.1 / T-6.1.2 / T-6.3.1 still unapproved; `main` unchanged (abf75d2); Supabase still proxy 403 (F-1). Fresh verifiers on #32, #27, #30: all three first returned findings. #30: leftover no-server/no-network claims → fixed b9d11b9 (PR body store draft corrected) → PASS. #27: Recent-result Replace regression → fixed 5715553 → PASS. #32: session-renewal race resurrected credentials after sign-out → fixed in three rounds (cbc1124, 5c22c9f, a9ebd46), each re-verified by a fresh agent → PASS (unit 34/34, E2E 75/75). T-5.3.1, T-5.3.2, T-7.2.3 → VERIFIED, plan boxes ticked; evidence comments on #27 and #30. Wrote `decisions/T-2.4.3-token-reach.md` for the F-14 remainder. Opened F-15, F-16. Phase 5 sweep skipped (no logged-in browser, dashboard needs Supabase). Another session concurrently noted 5715553/cbc1124 in this ledger; merged.
- 2026-11-28 loop 10 (cloud, ~40 min) — No owner activity since loop 9: decisions T-3.0.1 / T-3.1.1 / T-6.1.2 / T-6.3.1 / T-2.4.3-token-reach still have an empty `APPROVED:`; `main` unchanged (abf75d2); Supabase still unreachable (000, F-1). Epic 6 is still blocked, so the loop took the independent fixes. Built #33 (F-15 shared in-flight renewal, stacked on #32): the new unit test fails without the fix; with it, unit 35/35, E2E 75/75 and CI green. Built #34 (F-16 exact permission assert, base `main`): drift probes rejected, E2E green, CI green. A fresh verifier passed #33 (3 race probes) and #12 (runtime boundary check via `next start`), and evidence comments were posted on both. #34 is left NEEDS-REVIEW. No plan boxes ticked (no plan task moved to VERIFIED). Phase 5 sweep skipped (no logged-in browser, dashboard needs Supabase).
- 2026-11-28 loop 11 (cloud, ~15 min) — No owner activity since loop 10: all five decision files still have an empty `APPROVED:`; `main` unchanged (abf75d2); Supabase still proxy 403 (F-1). Fresh verifier PASS on #34 (typecheck, prettier, build, 9 drift probes, unit 12/12, E2E 37/37) and an evidence comment posted. Built #35 (base #34): the assert now also refuses `optional_permissions` and `optional_host_permissions` (build ok, 5 probes as expected, CI quality + e2e green); NEEDS-REVIEW. No plan boxes ticked (T-7.3.2 is the release itself, still PENDING). Epic 6 still blocked on decisions T-6.1.2 / T-6.3.1.
- 2026-11-28 loop 12 (cloud, ~20 min) — No owner activity since loop 11: all five decision files still have an empty `APPROVED:`; `main` unchanged (abf75d2); no new PR comments; Supabase still proxy 403 (F-1). Fresh verifier PASS on #35 (typecheck 2/2, prettier, build, 13 drift probes, unit 12/12, E2E 37/37); evidence comment posted. Built #36 (base #35): the manifest assert prints each failed check instead of exiting silently (7 probes, build ok, unit 12/12, E2E 37/37; CI quality + e2e green); NEEDS-REVIEW. No plan boxes ticked (T-7.3.2 is the release itself, still PENDING). Epic 6 still blocked on decisions T-6.1.2 / T-6.3.1.
- 2026-11-28 loop 13 (cloud, ~10 min) — No owner activity since loop 12: all five decision files still have an empty `APPROVED:`; `main` unchanged (abf75d2); no new PR comments. Fresh verifier PASS on #36 (typecheck 2/2, prettier, build, 17 drift probes, unit 12/12, E2E 37/37); evidence comment posted; one cosmetic nit recorded under F-16. No plan boxes ticked (T-7.3.2 is the release itself, still PENDING). Epic 6 still blocked on decisions T-6.1.2 / T-6.3.1; no cloud-actionable review work remains.
- 2026-11-28 loop 14 (cloud, ~10 min) — No owner activity since loop 13: all five decision files still have an empty `APPROVED:`; `main` unchanged (abf75d2); no new PR comments. Fixed the F-16 nit on #36 (1e7da52): non-numeric `minimum_chrome_version` → named failure, invalid JSON → "is not valid JSON" (4 probes as expected; extension build + assert ok, prettier, tsc green; E2E not rerun, shell-only change, CI covers it). Left NEEDS-REVIEW for a fresh verifier. Epic 6 still blocked on decisions T-6.1.2 / T-6.3.1. No plan boxes ticked.
- 2026-11-28 loop 15 (cloud, ~95 min) — The owner opened Epic 6 Story 6.1 as drafts #37–#39 (T-6.1.2 / T-6.1.3 / T-6.1.4), stacked on #32 and building decision T-6.1.2 option A. All decision files are still blank; `main` unchanged (abf75d2).
  - Fresh verifier at #39: typecheck, prettier and build pass; unit 38/38, E2E 86/86. It found F-17 (high, reproduced: a save after sign-out writes the library and first-save flag back), F-18 (medium, two session managers) and F-19 (low).
  - #36's 1e7da52 PASS (F-16 closed). T-6.1.4 → VERIFIED, boxes ticked.
  - Built three stacked drafts: #40 (F-17 fix + unsynced `fetchedAt: 0`; new checks fail without the fix), #41 (T-6.3.4 offline save disabled, save-prompt 21/21), #42 (T-6.2.1 edit push via worker PATCH relay + `replaceCachedPrompt`; unit 44/44, E2E 96/96).
  - Evidence comment posted on #37. A fresh verifier on #40–#42 was dispatched (result below).

