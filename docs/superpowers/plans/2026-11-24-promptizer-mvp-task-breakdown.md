# Promptizer MVP — task breakdown & estimation

Date: 2026-11-24
Status: draft, awaiting review
Parent plan: `docs/superpowers/plans/2026-11-24-promptizer-mvp.md`

> **For agentic workers:** this is the **review & estimation breakdown** derived from the parent
> product plan. Each task is capped at **3 hours**, carries a reviewable checklist as its
> definition of done, and is sized for one experienced developer working alone. Tasks marked **⇉**
> are self-contained enough to be handed to a subagent (give it the task block plus the parent
> story's journey). Implementation plans (files, steps, commits) are written per task at execution
> time, after the task's decision notes are resolved.

## How to read

- **Order** = recommended execution sequence, top to bottom. `after` = hard dependency.
- **Type** — `decision` = a tech choice the product owner makes or delegates (output: a decision
  note in the task's implementation plan) · `infra` = foundation without user-visible change ·
  `feat` = user-visible · `test` · `docs` · `debt` · `qa` = manual verification.
- **Est** = hours, including the task's own tests and self-review. Excludes cross-task QA.
- **⇉** = subagent-ready: independent of the task directly before it, crisp checklist, no open
  decisions inside it.
- No technology is chosen in this document. Every stack, storage, and protocol choice lives inside
  a `decision` task.

**Estimation assumptions:** one developer; workspace conventions from Epic 1 are already in place;
each task ends with the repo green (checks pass). Slack for review ping-pong is not included — add
~20% if every task gets a human review pass.

---

## Epic 1 — Workspace foundation · 12h

Executed per `docs/superpowers/plans/2026-11-24-epic1-workspace-foundation.md` (T-1.1.1's decision
record: Turborepo orchestration; owner-added `packages/ui` and `packages/i18n`; `apps/web` and
`apps/worker` omitted). Nothing user-visible changes; this epic is the regression guard for the whole
MVP.

**Status (2026-11-24):** T-1.1.1–T-1.1.6 complete. T-1.1.7 automated verification passed;
manual Journey A remains open because browser control was unavailable. The foundation was merged
in PR #7. Follow-up testing cleanup removes Vitest and uses the existing E2E suite as the primary guard.

**T-1.1.1 · Workspace layout & orchestration decision** · 1h · decision
after: —
- [x] Layout diagram (apps + packages, exact names) written down and approved
- [x] One task-orchestration approach chosen for running checks across all apps
- [x] Decision recorded where the Epic 1 implementation plan will live
- [x] Any repo rule that must change is listed for the owner to approve (moving files is "ask first")

**T-1.1.2 · Scaffold the workspace root** · 1.5h · infra
after: T-1.1.1
- [x] Root manifest declares the workspace and pins the repo's existing tooling rules
- [x] Installing from the root works and produces one lockfile, no duplicates
- [x] A root-level command runs one check across every app
- [x] Existing repo pins (package manager version, allowed install scripts, build-tool major) are carried over unchanged

**T-1.1.3 · Move the extension into its app slot** · 2h · infra
after: T-1.1.2
- [x] Extension sources and build config live in the new app slot, unchanged in behavior
- [x] Build output path updated; the manifest assertion script still passes
- [x] The E2E suite runs green from the new location
- [x] No leftover duplicates of extension files at the old location

**T-1.1.4 · Shared-definitions package shell** · 1h · infra ⇉
after: T-1.1.2 (can run while T-1.1.3 is in flight)
- [x] Shared-definitions package shell exists and is resolvable from the extension app
- [x] One placeholder definition compiles and imports from the extension app
- [x] Package contains no behavior, only definitions

**T-1.1.5 · Contributor docs point at the new layout** · 1h · docs ⇉
after: T-1.1.3
- [x] Setup, verify, and test instructions match the new paths
- [x] Active contributor docs use the new layout (historical plans and changelog entries are excluded)
- [x] A newcomer following the docs from scratch lands in the right places

**T-1.1.6 · Remove stale artifacts** · 0.5h · debt ⇉
after: T-1.1.2
- [x] The leftover compiled CLI binary and any dead references are deleted
- [x] No active code or contributor instructions reference the removed files
- [x] Workspace checks still pass

**T-1.1.7 · Full workspace verify pass** · 1h · qa
after: all Epic 1 tasks
- [x] Every check (types, formatting, build, manifest assertion, E2E) passes from the root
- [ ] Built extension loaded by hand and behaves identically (Journey A smoke: chip appears, one rewrite works)

---

## Epic 2 — Accounts & simple authentication · 36h

**Status (2026-11-25):** Epic 2 is implemented end to end on branch `feature/accounts-auth-backend`
(uncommitted). Backend verified live against the hosted Supabase project: 22/22 tests pass
(`pnpm -C apps/web test`). Supabase limits sign-ins to roughly 30 per 5 minutes per IP and a full test run uses
about that many, so wait ~5 minutes between runs; a 429 is reported as `rate_limited`, never as wrong credentials.
The dashboard journeys (`pnpm -C apps/web run test:e2e`, 20 checks) and the popup Account journey
(`apps/chrome-extension/e2e/tests/account.mjs`, 7 checks, backend mocked) pass; every Epic 2 task is `[x]`.
Run `test:e2e` at most every ~5 minutes (Supabase sign-in rate limit).
Legend: `[x]` done and verified · `[~]` implemented, verification pending — needs a live
Supabase run (`pnpm -C apps/web test` with `apps/web/.env`) or a browser pass · `[ ]` not done
(T-2.2.6 session E2E tests are the only task not started).

**Epic 2 decisions (T-2.0.1, T-2.0.3, T-2.2.1, T-2.4.1):**
- Backend: Next.js app `apps/web` serves API routes and the dashboard. The extension reaches it through one
  allow-listed origin (`EXTENSION_ORIGIN` CORS in `src/proxy.ts`); no `host_permissions` added.
- Accounts: Supabase Auth owns the account record (id, email, name in user metadata) and password hashing; there is
  no custom table, so no migrations. Hosted Supabase project in every environment.
- Dashboard session: httpOnly cookies carrying the Supabase access (lifetime of the token) and refresh (30 days)
  tokens; an expired session behaves as no session (redirect with return-to). Sign-out revokes server-side.
- Extension session: bearer tokens kept in `storage.local`, renewed silently 60 s before expiry; sign-out or a
  rejected renewal wipes them; an offline renewal keeps them.
- Keys: only the new Supabase API keys are used — publishable (`sb_publishable_…`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
  and secret (`sb_secret_…`, `SUPABASE_SECRET_KEY`, server only). Legacy `anon`/`service_role` keys are deprecated by
  end of 2026 and are not referenced anywhere.
- Password change revokes every session (Supabase behavior) and returns a fresh session for the caller.
- UI: shadcn/ui (Radix, Tailwind v4) in `apps/web`, themed through `--pz-*` tokens in `globals.css`.

**Story 2.0 — Backend foundation.** The first technical ground to lay; no accounts work without it.

**T-2.0.1 · Backend stack & skeleton decision** · 1h · decision
after: Epic 1
- [x] Language + framework chosen for the backend app
- [x] How the dashboard is served (same app vs separate app) decided
- [x] How the extension will reach the backend (origin, allowed callers) decided at the headline level
- [x] Decision note written; nothing implemented yet

**T-2.0.2 · Backend app scaffold in the workspace** · 2h · infra
after: T-2.0.1
- [x] New app runs from the workspace with one command
- [x] A health route answers and is reachable in local development
- [x] The app passes the same checks (types, tests, formatting) as its siblings
- [x] Shared-definitions package is importable from the backend app

**T-2.0.3 · Account persistence decision** · 1h · decision
after: T-2.0.1 ⇉ (independent of T-2.0.2)
- [x] Storage engine and migration approach chosen
- [x] Account record fields fixed (id, email, name, secret, timestamps — nothing more)
- [x] How passwords are stored (hashing approach) chosen
- [x] Local vs deployed persistence story sketched (must survive to production unchanged)

**T-2.0.4 · Persistence foundation** · 2h · infra
after: T-2.0.2, T-2.0.3
- [x] Migrations apply from clean to current in one command
- [x] The account table exists with exactly the decided fields
- [x] A connection is established per app start and closed cleanly on stop
- [x] A trivial write/read round-trip proves the wiring

**Story 2.1 — Register.** Email + password, no email sent, signed in immediately.

**T-2.1.1 · Credential hashing & verification** · 1.5h · feat
after: T-2.0.4
- [x] Passwords are hashed with the approach chosen in T-2.0.3; plaintext never stored or logged
- [x] Verification helper proves correct/incorrect passwords in unit tests
- [x] Known weak inputs (empty, over-length) rejected by the helper

**T-2.1.2 · Registration endpoint** · 2h · feat
after: T-2.1.1
- [x] Accepts email, password, name; creates the account; returns a signed-in result
- [x] Duplicate email → friendly, non-enumerating error; no account created
- [x] Invalid email format / missing fields → field-level errors
- [x] Zero emails sent anywhere (asserted in tests)

**T-2.1.3 · Sign-up page** · 2.5h · feat ⇉
after: T-2.1.2 (start after the endpoint contract is sketched; finish in parallel)
- [x] Form with the three fields, inline validation errors
- [x] Successful registration lands the user signed-in at the dashboard home
- [x] Duplicate-email error rendered as a friendly inline message
- [x] Page is reachable anonymously and unreachable when already signed in

**T-2.1.4 · Registration tests** · 1.5h · test ⇉
after: T-2.1.2
- [x] Happy path, duplicate email, invalid inputs, over-length inputs all covered
- [x] Test proves no email side-effect occurs
- [x] Tests run in the workspace suite, not ad hoc

**Story 2.2 — Sign in / sign out / session.**

**T-2.2.1 · Dashboard session approach decision** · 0.5h · decision
after: T-2.1.2
- [x] Session mechanism for browser pages chosen (with its tampering protection)
- [x] Lifetime and expiry behavior fixed (idle timeout vs absolute)
- [x] Where sign-out state lives for the extension vs the dashboard is distinguished

**T-2.2.2 · Sign-in & sign-out endpoints** · 2h · feat
after: T-2.2.1
- [x] Correct credentials → signed-in state established
- [x] Wrong credentials → one honest, non-enumerating error
- [x] Sign-out invalidates the session on the server, not just the client
- [x] Endpoints covered by tests

**T-2.2.3 · Session expiry behavior** · 1.5h · feat
after: T-2.2.2
- [x] An expired session is treated exactly like no session (redirect, not error)
- [x] Expiry mid-action lands the user somewhere sensible, data-loss free
- [x] Behavior pinned by a test

**T-2.2.4 · Route guard with return-to** · 2h · feat
after: T-2.2.2
- [x] Anonymous visit to a protected page → sign-in page carrying the original destination
- [x] Signing in returns the user to that destination
- [x] Signed-in users cannot reach sign-in/sign-up pages
- [x] Guard proven for deep links, not just the home page

**T-2.2.5 · Sign-in page UI** · 2h · feat ⇉
after: T-2.2.2
- [x] Email + password form with the wrong-credentials error inline
- [x] Link to sign-up and back; no dead ends
- [x] Follows the app shell conventions set by the dashboard skeleton

**T-2.2.6 · Session tests** · 1.5h · test ⇉
after: T-2.2.4
- [x] Guard redirect + return-to covered for a protected deep link
- [x] Sign-out followed by browser Back does not regain access
- [x] Expiry path covered

**Story 2.3 — Change password.**

**T-2.3.1 · Change-password endpoint** · 1.5h · feat
after: T-2.2.2
- [x] Requires current password; wrong current password → error, no change
- [x] New password stored under the same hashing rules
- [x] Other active sessions policy decided-and-documented in the endpoint's tests

**T-2.3.2 · Change-password page** · 1.5h · feat ⇉
after: T-2.3.1
- [x] Current + new + confirm fields with inline validation
- [x] Success and both failure cases (wrong current, mismatched new) rendered honestly
- [x] Reachable only when signed in

**T-2.3.3 · Change-password tests** · 1h · test ⇉
after: T-2.3.1
- [x] Wrong current password rejected; new password works on next sign-in
- [x] Mismatch confirmation rejected client-side

**Story 2.4 — Sign in from the extension.**

**T-2.4.1 · Extension credential flow decision** · 1h · decision
after: T-2.2.2
- [x] How the extension authenticates to the backend chosen (token vs bridged session)
- [x] Where credentials live on the machine and what wipes them
- [x] Renewal/expiry policy fixed; the extension must survive browser restarts without re-login
- [x] The narrowest possible network reach for the extension is named (one origin)

**T-2.4.2 · Extension auth client** · 1.5h · feat
after: T-2.4.1
- [x] Sign-in and sign-out calls from the extension, using the flow chosen above
- [x] Wrong-credentials mapped to one inline-friendly error
- [x] Network failure mapped to a retryable error, distinct from wrong credentials
- [x] Client is a pure module with unit-tested error mapping

**T-2.4.3 · Credential persistence & renewal** · 2.5h · feat
after: T-2.4.2
- [x] Restarting the browser leaves the user signed in
- [x] Expiry triggers silent renewal; failed renewal → clean signed-out state
- [x] Credentials stored per the decision, scoped to the extension, never logged
- [x] Renewal and failed-renewal paths unit-tested

**T-2.4.4 · Account screen in the popup** · 2.5h · feat ⇉
after: T-2.4.2 (UI can be built against a stubbed client while T-2.4.3 lands)
- [x] Signed-out state: sign-in form, link to dashboard sign-up
- [x] Signed-in state: identity shown, sign-out control, library sync status placeholder
- [x] Follows the existing popup screen conventions (navigation, focus, styling tokens)
- [x] Screen unreachable path: nothing breaks for a signed-out user who never opens it

**T-2.4.5 · Extension auth tests** · 1.5h · test
after: T-2.4.3, T-2.4.4
- [x] Sign-in → restart → still signed in, in a simulated environment
- [x] Sign-out wipes credentials; popup returns to signed-out state
- [x] Failed renewal degrades to signed-out without errors surfacing elsewhere

---

## Epic 3 — Prompt management · 34h

**Status (2026-11-27):** implemented on `main` before loops started. Loop 1 static audit: all tasks pass except T-3.0.1 (pack shape, decision pending) and T-3.1.1 (decision record pending); gap fixes in draft PRs #9 and #10. Boxes stay unticked until the Supabase-backed suites run (ledger F-1).

**Story 3.0 — Library foundation.**

**T-3.0.1 · Prompt & pack data-shape decision** · 1h · decision
after: T-2.0.4
- [ ] Prompt fields fixed (id, owner, title, text, timestamps — nothing more)
- [ ] Pack fields fixed (id, owner, name, timestamps) and how prompts relate to packs decided
- [ ] Both definitions written into the shared-definitions package, importable by backend and extension
- [ ] Text size limit chosen and encoded as a shared constant

**T-3.0.2 · Prompt persistence, owner-scoped** · 2h · infra
after: T-3.0.1
- [ ] Migrations create the prompt storage with owner scoping
- [ ] Create/read/update/delete by owner works; reading a foreign or missing id yields not-found, not an error leak
- [ ] Round-trip preserves text exactly (whitespace, line endings)

**Story 3.1 — Create & view a prompt.**

**T-3.1.1 · Markdown rendering & sanitization decision** · 0.5h · decision
after: T-3.0.1 ⇉
- [ ] One renderer + sanitizer approach chosen for the dashboard
- [ ] The list of allowed constructs fixed (basic Markdown; everything else passes through as text)
- [ ] Rendering happens where decided (client vs server) and the choice is recorded

**T-3.1.2 · Markdown preview helper** · 2.5h · feat
after: T-3.1.1
- [ ] Renders the chosen Markdown subset with HTML escaped/sanitized (script injection test fails closed)
- [ ] Rendering failure shows an inline error, never a crash
- [ ] Unit tests cover: headings/lists/links, raw HTML passthrough as text, hostile input

**T-3.1.3 · Create-prompt endpoint** · 2h · feat
after: T-3.0.2
- [ ] Requires title and text within the shared size limit; validation errors are field-level
- [ ] Creates the prompt owned by the caller; returns its identity
- [ ] Requires a valid session; anonymous calls rejected
- [ ] Endpoint tests: happy path, missing title, oversized text, anonymous

**T-3.1.4 · New-prompt page** · 2.5h · feat ⇉
after: T-3.1.3 (start on a sketched contract)
- [ ] Title + Markdown text form with a preview toggle
- [ ] Validation errors inline; success navigates to the new prompt's page
- [ ] Follows the dashboard shell conventions

**T-3.1.5 · Prompt view page** · 2h · feat ⇉
after: T-3.1.3
- [ ] Shows title, rendered text, and edit/delete affordances (wired to later stories is fine — visible entry points must exist)
- [ ] Foreign or missing prompt id → the app's not-found page
- [ ] Deep-linkable (refresh keeps you there)

**T-3.1.6 · Ownership isolation tests** · 1h · test ⇉
after: T-3.1.5
- [ ] Two accounts: each can list/see only their own prompts, by direct id too
- [ ] Not-found (not forbidden) is the response for foreign ids

**Story 3.2 — List & find.**

**T-3.2.1 · List endpoint** · 2.5h · feat
after: T-3.0.2
- [ ] Paginated list, newest first, owner-scoped
- [ ] Text search matches title and text; pack filter restricts to one pack
- [ ] Out-of-range page behaves gracefully (empty, not error)
- [ ] Tests cover search, filter, page boundaries

**T-3.2.2 · Prompt list page** · 2.5h · feat ⇉
after: T-3.2.1 (contract sketched)
- [ ] Cards with title, truncated rendered preview, timestamps
- [ ] Pagination controls; current search/filter preserved across pages
- [ ] Heading shows the total count

**T-3.2.3 · Search & pack filter controls** · 1.5h · feat
after: T-3.2.2
- [ ] Search box submits on Enter; active filters visible with a clear-all control
- [ ] Pack filter lists the user's packs
- [ ] URL carries the filters (shareable/refreshable state)

**T-3.2.4 · Empty & no-result states** · 1h · feat ⇉
after: T-3.2.2
- [x] New account: an honest empty state with "create your first prompt" as the primary action
- [x] No search hits: guidance + clear-filters
- [x] No dead ends anywhere in the list surface

**T-3.2.5 · List tests** · 1.5h · test ⇉
after: T-3.2.3
- [ ] Search, pack filter, clear-all, pagination boundaries covered end to end
- [ ] Empty-state and no-result rendering pinned

**Story 3.3 — Edit & auto-save.**

**T-3.3.1 · Update endpoint** · 1.5h · feat
after: T-3.0.2
- [ ] Updates title/text for the owner; validation mirrors the create rules
- [ ] Returns the saved state (so the client can confirm honestly)
- [ ] Tests: partial update, oversized text, foreign id, anonymous

**T-3.3.2 · Editor page with live preview** · 2.5h · feat
after: T-3.3.1, T-3.1.2
- [ ] Edit textarea + live rendered preview with a toggle
- [ ] Character count shown; heading shows the prompt title
- [ ] Navigating away with unsaved (mid-debounce) text warns once

**T-3.3.3 · Auto-save client** · 2.5h · feat
after: T-3.3.2
- [ ] Debounced save shortly after typing stops; visible save state (saving / saved / failed)
- [ ] Failed save is surfaced with a retry — never silent, never data loss without warning
- [ ] Debounce timing and failure path unit-tested

**T-3.3.4 · Auto-save tests** · 1.5h · test ⇉
after: T-3.3.3
- [ ] Typing → pause → one save, not per keystroke
- [ ] Failure → visible state + retry succeeds
- [ ] Rapid navigation does not fire late saves into the wrong prompt

**Story 3.4 — Delete.**

**T-3.4.1 · Delete endpoint** · 1h · feat
after: T-3.0.2
- [ ] Owner-only delete; foreign/missing id → not-found
- [ ] Prompt removed from every list and pack membership
- [ ] Endpoint tests included

**T-3.4.2 · Delete confirmation flow** · 1.5h · feat ⇉
after: T-3.4.1
- [ ] Confirmation page names the prompt and warns it cannot be undone
- [ ] Cancel returns to the prompt; delete lands on the list
- [ ] Deep-linking to a deleted prompt shows not-found

**T-3.4.3 · Delete tests** · 1h · test ⇉
after: T-3.4.2
- [ ] Delete → gone from list, packs, and its own URL
- [ ] Confirmation required (no accidental single-click deletion)

---

## Epic 4 — Prompt packs · 14.5h

**Story 4.1 — Pack management.**

**T-4.1.1 · Pack persistence & endpoints** · 2.5h · feat
after: T-3.0.1
- [ ] Create, rename, delete packs, owner-scoped; name required with a friendly error
- [ ] Deleting a pack leaves every prompt in it fully intact and still listed under All prompts
- [ ] Tests cover the preservation rule explicitly

**T-4.1.2 · Pack management UI** · 2h · feat ⇉
after: T-4.1.1 (contract sketched)
- [ ] Create-rename-delete reachable from the sidebar packs section
- [ ] Delete confirms first, with the "prompts are kept" explanation in the dialog
- [ ] Follows dashboard shell conventions

**T-4.1.3 · Pack-deletion preservation tests** · 1.5h · test ⇉
after: T-4.1.1
- [ ] Pack with members deleted → all prompts remain, counts correct, no orphans in listings
- [ ] Rule pinned in the workspace suite

**Story 4.2 — Prompts in packs.**

**T-4.2.1 · Membership endpoints** · 2h · feat
after: T-4.1.1
- [ ] Add and remove a prompt to/from a pack, owner-checked on both entities
- [ ] Adding to a foreign pack or a foreign prompt → not-found
- [ ] Endpoint tests included

**T-4.2.2 · Membership UI** · 2.5h · feat
after: T-4.2.1, T-4.3.1 helps but not required
- [ ] From a prompt's page: add-to-pack picker and per-pack remove
- [ ] From a pack's page: add prompts via a searchable picker; remove inline
- [ ] Membership visible on both surfaces; counts update immediately

**T-4.2.3 · Membership & count tests** · 1h · test ⇉
after: T-4.2.2
- [ ] Add/remove reflected in pack counts and the prompt's pack list
- [ ] Same prompt in multiple packs behaves per the T-3.0.1 decision, consistently on both surfaces

**Story 4.3 — Pack view.**

**T-4.3.1 · Pack view page** · 2h · feat
after: T-4.1.1
- [ ] Pack name, description-less header, prompt count, its prompt cards
- [ ] Opening a prompt from the pack works; back returns to the pack
- [ ] Empty pack shows guidance, not a blank page

**T-4.3.2 · Navigation orientation pass** · 1h · feat
after: T-4.3.1, T-3.2.2
- [ ] Sidebar packs section lists packs with counts, current pack highlighted
- [ ] Breadcrumbs or back controls keep pack → prompt → back oriented
- [ ] Deep links into a pack work after refresh

---

## Epic 5 — Extension library access · 19h

**Story 5.1 — Library sync.**

**T-5.1.1 · Snapshot & cache decision** · 1h · decision
after: T-2.4.3, T-4.1.1
- [ ] Snapshot contents fixed (prompts + packs + membership, one payload)
- [ ] Where the local copy lives in the extension chosen, with its wipe path
- [ ] Staleness policy fixed (when a refresh is triggered automatically)
- [ ] Payload shape written into the shared-definitions package

**T-5.1.2 · Library snapshot endpoint** · 2h · feat
after: T-5.1.1
- [ ] Returns the caller's whole library (prompts, packs, membership) in one authenticated call
- [ ] No other user's data can appear (test with two accounts)
- [ ] Includes a library-level timestamp for staleness checks

**T-5.1.3 · Extension cache layer** · 2h · feat
after: T-5.1.1
- [ ] Snapshot stored locally per the decision; readable by popup and content flow
- [ ] Cache invalidation/wipe API exists and is unit-tested
- [ ] Corrupt or missing cache degrades to "empty library, refresh needed," never an error state

**T-5.1.4 · Refresh flow** · 2h · feat
after: T-5.1.2, T-5.1.3
- [ ] Refresh on sign-in, on manual trigger, and when stale per policy
- [ ] Refresh preserves in-progress UI (no flicker/lost state in the picker)
- [ ] Refresh failure leaves the previous cache usable with an honest status

**T-5.1.5 · Sync status display** · 1h · feat ⇉
after: T-5.1.4
- [ ] Popup shows signed-in identity, library size, last-synced time
- [ ] Failure/staleness shown honestly with a refresh button

**T-5.1.6 · Sync tests** · 1.5h · test ⇉
after: T-5.1.4
- [ ] Sign-in → cached; refresh → updated; wipe → empty; corrupt → recoverable
- [ ] Two-account sequence never leaks one library into the other's cache

**Story 5.2 — Prompt picker.**

**T-5.2.1 · Rail "My Prompts" item** · 1h · feat
after: T-5.1.3
- [ ] Rail shows the item only when signed in; never for signed-out users (regression-checked)
- [ ] Item follows existing rail conventions (icons, order, keyboard navigation)

**T-5.2.2 · Picker UI** · 2.5h · feat
after: T-5.2.1
- [ ] Pack browse + search by title, in the existing result-window shell conventions
- [ ] Keyboard navigation and Esc behavior match the rail's rules
- [ ] Empty library shows the honest empty state with a pointer to the dashboard

**T-5.2.3 · Insert into preview** · 1.5h · feat
after: T-5.2.2
- [ ] Picking a prompt places its text into the existing editable preview, then Replace/Dismiss as usual
- [ ] Insert works in the same field types the chip already supports
- [ ] The existing write-back path is used unchanged

**T-5.2.4 · Offline read-only behavior** · 1h · feat
after: T-5.2.2
- [ ] Offline: picker opens and inserts work from cache
- [ ] Offline: edit/save actions are visibly disabled with one clear message
- [ ] Coming back online restores the actions without a restart

**T-5.2.5 · Picker tests** · 1.5h · test ⇉
after: T-5.2.3
- [ ] Signed-in gating, search, insert path, offline gating all pinned
- [ ] Late/duplicate interactions cannot corrupt the open preview (existing generation discipline)

**Story 5.3 — Sign-out wipes.**

**T-5.3.1 · Sign-out wipe** · 1h · feat
after: T-5.1.3, T-2.4.4
- [ ] Sign-out removes credentials and the entire local library copy
- [ ] Wipe verified for the popup, the rail, and the cache store itself

**T-5.3.2 · Wipe tests** · 1h · test ⇉
after: T-5.3.1
- [ ] After sign-out: no prompt content remains on the machine; chip works exactly as Journey A
- [ ] Re-sign-in rebuilds the cache from the account

---

## Epic 6 — Save & sync from the extension · 17h

**Story 6.1 — Save prompt.**

**T-6.1.1 · Save-prompt endpoint** · 1.5h · feat
after: T-5.1.2
- [ ] Creates a prompt owned by the caller from title + text, with the same validation as the dashboard
- [ ] Session required; foreign/anonymous rejected
- [ ] Returns the created prompt; local cache update is the client's job (no hidden sync magic)

**T-6.1.2 · Rail "Save prompt" action + title step** · 2h · feat
after: T-6.1.1
- [ ] Rail action captures the field's current text only on explicit click
- [ ] Title step before saving, prefilled sensibly, editable; cancel aborts with nothing sent
- [ ] Saved → confirmation visible; library count updates

**T-6.1.3 · One-time first-save notice** · 1h · feat ⇉
after: T-6.1.2
- [ ] The first save ever shows the "stored in your Promptizer account" notice; never again after
- [ ] Notice is dismissible and does not block the save
- [ ] Flag stored locally; reset only on sign-out

**T-6.1.4 · Save flow tests** · 1h · test ⇉
after: T-6.1.2
- [ ] Explicit-only capture pinned: no text leaves the machine without the action
- [ ] Cancel path sends nothing; failed save is surfaced

**Story 6.2 — Edit from the extension.**

**T-6.2.1 · Edit push from the extension** · 1.5h · feat
after: T-5.2.3, T-3.3.1
- [ ] Editing title/text from the extension uses the same update path as the dashboard
- [ ] Local cache updated after the server confirms
- [ ] Validation errors from the server shown inline in the picker

**T-6.2.2 · Edit UI in the picker** · 2h · feat
after: T-6.2.1
- [ ] Edit affordance on a saved prompt; title/text editable; save/cancel explicit
- [ ] Delete affordance with confirmation (same rules as the dashboard)
- [ ] Flows through the preview conventions, not a second editing paradigm

**T-6.2.3 · Edit sync tests** · 1h · test ⇉
after: T-6.2.2
- [ ] Extension edit visible on dashboard; dashboard edit visible in extension after refresh
- [ ] Cache and account agree after every operation

**Story 6.3 — Conflicts & errors.**

**T-6.3.1 · Conflict detection decision** · 0.5h · decision
after: T-3.3.1
- [ ] One rule chosen (e.g. base-timestamp comparison) applying to every write from the extension
- [ ] The refusal payload fixed: current server text travels with the refusal
- [ ] Rule documented in the shared-definitions package

**T-6.3.2 · Conflict refusal & "updated elsewhere" UI** · 2.5h · feat
after: T-6.3.1, T-6.2.1
- [ ] Stale save refused; current text shown; user can review and retry deliberately
- [ ] The newer server text is never silently overwritten
- [ ] Conflict path unit-tested on both the endpoint and the client

**T-6.3.3 · Network error retry states** · 1.5h · feat
after: T-6.2.1
- [ ] Failed save/edit offers retry with the text preserved locally
- [ ] Distinct from wrong-credentials and from conflict (three different honest messages)
- [ ] Retry succeeds after recovery

**T-6.3.4 · Offline save disabled state** · 1h · feat ⇉
after: T-5.2.4
- [ ] Offline: save/edit actions disabled with the read-only message
- [ ] Nothing is queued in the MVP; behavior is explicit and honest

**T-6.3.5 · Conflict & error tests** · 1.5h · test ⇉
after: T-6.3.2, T-6.3.3
- [ ] Stale-write, network-failure, and offline paths all pinned
- [ ] Server copy survives every client failure mode

---

## Epic 7 — End-to-end hardening & release · 14h

**Story 7.1 — Journey verification.**

**T-7.1.1 · Journey A regression pass** · 1.5h · qa
after: all epics
- [ ] A never-signed-in user sees no behavioral difference anywhere in the extension
- [ ] Only visible addition: the sign-in entry point, discovered by opening it deliberately
- [ ] Existing automated suites all green; findings fixed or filed

**T-7.1.2 · Journey B end-to-end pass** · 2h · qa
after: all epics
- [ ] Steps 1–9 of Journey B pass on a real build against a real deployed service
- [ ] Every step's failure modes spot-checked (wrong password, offline, stale)
- [ ] Findings triaged into fix tasks before release

**T-7.1.3 · Journeys C & D pass** · 1.5h · qa ⇉
after: T-7.1.2
- [ ] Conflict journey behaves exactly as the parent plan's Journey C
- [ ] Sign-out wipe verified on a second machine too
- [ ] Account remains reachable on the dashboard after extension sign-out

**Story 7.2 — Privacy commitments, enforced & documented.**

**T-7.2.1 · Privacy principles verification** · 1.5h · qa
after: all epics
- [ ] Each of the five product principles demonstrable to a non-developer
- [ ] Server logs inspected: no prompt content, no credentials, ever
- [ ] The one-time save notice, sign-out wipe, and offline gating all observed live

**T-7.2.2 · Documentation update** · 2h · docs ⇉
after: T-7.2.1
- [ ] Features, architecture, and README describe the library and sync honestly — including what now leaves the machine, when, and why
- [ ] Privacy claims match observed behavior exactly; nothing overstated
- [ ] Store listing materials reviewed for consistency

**T-7.2.3 · Permission-change explanation** · 1h · docs ⇉
after: T-2.4.1 outcome known (can be drafted much earlier)
- [ ] The extension's new network reach is explained in one sentence a user can understand
- [ ] Justification text ready for the store's permission declaration

**Story 7.3 — Release readiness.**

**T-7.3.1 · Service deployment & smoke test** · 2.5h · infra
after: T-7.1.2
- [ ] Service deployed with secrets managed outside the repo; migrations applied
- [ ] Smoke test from a clean machine: sign-up → create → sign-in from extension
- [ ] Backup/restore approach for the account data proven once

**T-7.3.2 · Extension version bump & release** · 2h · feat
after: T-7.3.1, T-7.2.2
- [ ] Version bumped; release checks pass; tag-driven build green
- [ ] Fresh install + upgrade both verified (existing users keep local-only behavior until they sign in)

---

## Summary

| Epic | Tasks | Hours | Lane notes |
| ---- | ----- | ----- | ---------- |
| 1 · Workspace foundation | 9 | 12 | per the Epic 1 plan; T-1.1.1 done as its decision record |
| 2 · Accounts & auth | 22 | 36 | Story 2.4 can start once 2.2 endpoints exist — runs beside Epics 3–4 |
| 3 · Prompt management | 20 | 34 | endpoint → page pairs; pages & tests largely ⇉ |
| 4 · Prompt packs | 8 | 14.5 | overlaps Epic 3 after T-3.0.1 |
| 5 · Extension library access | 13 | 19 | after Story 2.4 + Epic 4 snapshot inputs |
| 6 · Save & sync | 12 | 17 | after Story 5.2 |
| 7 · Hardening & release | 8 | 14 | last; T-7.2.x ⇉ with T-7.1.x |
| **Total** | **92** | **146.5** | add ~20% if every task gets a human review pass |

### Critical path & subagent lanes

```
E1 ──► E2.0 ──► E2.1–2.3 ──► E3 ──► E4 ──► E5 ──► E6 ──► E7
              └──► E2.4 (extension auth) ──┐
                                            └── joins E5
```

- **Critical path:** E1 → E2 foundations → E3 → E4 → E5 → E6 → E7. Roughly 2 working weeks of
  solo effort before E2.4 starts overlapping.
- **Subagent lane 1 (backend):** every `after T-x.y.2` endpoint task and its tests once its
  contract is sketched.
- **Subagent lane 2 (dashboard pages):** every page marked ⇉ against sketched contracts.
- **Subagent lane 3 (extension surfaces):** popup account screen, picker UI, save flow —
  independent of the backend while Story 5.1/6.1 endpoints are in flight.
- **Decision tasks stay with the product owner** — every one blocks its `after` chain, so resolve
  them at the story's start, not mid-implementation.
