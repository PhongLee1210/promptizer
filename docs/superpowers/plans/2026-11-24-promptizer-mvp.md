# Promptizer MVP — prompt library & account sync — product plan

Date: 2026-11-24
Status: draft, awaiting review
Reference: `docs/features/CLONE_SPEC.md` (PromptWallet clean-room clone study — behavior reference only)

> **For agentic workers:** this is the **product-level plan**. Do not implement from this document
> directly. Each epic below is later expanded into its own superpowers implementation plan
> (task-by-task, with files and steps) **after** the technical choices for that epic have been made.
> This document deliberately contains no technology, framework, data-model, or API decisions.

**Goal:** let a Promptizer user create, organize, manage, and carry their prompts and prompt packs
across the web dashboard and the Chrome extension, under one account — while the extension keeps
working exactly as it does today for anyone who never signs in.

---

## 1. The big picture

Promptizer today is one thing: an on-device prompt rewriter. You type in a field on any site, the
chip rewrites it, you keep it or dismiss it. Nothing is stored, nothing leaves the machine.

The MVP adds a second thing around it: a **personal prompt library**.

```
   TODAY (unchanged, forever)                    NEW IN THE MVP
  ┌───────────────────────────┐   sign in    ┌─────────────────────────────┐
  │ type in a field on any    │◄─────────────│ your Promptizer account      │
  │ site → chip → rewrite →   │              │                              │
  │ preview → Replace/Dismiss │   insert     │  prompts        ┐            │
  └───────────────────────────┘─────────────►│  prompt packs    │ your      │
           works with no account,             │                  │ library  │
           no network, forever                └────────┬────────┘           │
                                                      │ managed on the      │
   any page: save the prompt in a field ──────────────►│ web dashboard,      │
   (explicit, opt-in)                                 │ used in the         │
                                                      │ browser extension    │
                                                      └─────────────────────┘
```

Two surfaces, one library:

- The **web dashboard** is where the library is built and managed: sign up, write prompts, group
  them into packs, edit and delete.
- The **browser extension** is where the library is *used*: sign in once, then insert a saved
  prompt into any field you are typing in, and save a good prompt you just wrote — without leaving
  the page.

The account is optional. A user who never signs in keeps today's product, byte for byte.

## 2. Product principles

These are commitments the MVP must keep, not preferences:

1. **Local-only by default.** The nine rewrite actions stay on-device. No account, no network, no
   change to how the chip behaves today.
2. **Sync is opt-in and explicit.** The only prompt content that ever leaves the machine is what the
   user deliberately saves to their own account, after being told so in plain language.
3. **The server never gossips.** Prompt content is never written to server-side logs; only account
   events (sign-in, item counts, timestamps) are.
4. **One source of truth.** The account is the truth; every surface's copy of the library is a
   disposable cache that can be rebuilt at any time. Signing out removes the local copy from the
   computer.
5. **The library is text in, text out.** A prompt is a title and Markdown text. Nothing in the MVP
   needs more than that.

**Deliberately out of this plan:** all technical decisions — languages, frameworks, data storage,
protocols, tooling. They are made per epic at implementation time, recorded in each epic's
implementation plan. This document stays at the business level so those choices stay reversible.

## 3. MVP scope

### In

| # | Capability | Priority |
| - | ---------- | -------- |
| 1 | Simple accounts: register with email + password, sign in, sign out, session management | Must |
| 2 | Password change on the dashboard (verifies current password) | Must |
| 3 | Prompt management on the dashboard: create, view, edit, delete, list, search | Must |
| 4 | Prompt packs: named groups of prompts; create, rename, delete, add/remove prompts | Must |
| 5 | Extension sign-in and sign-out | Must |
| 6 | Extension: browse the library and insert a saved prompt into any field | Must |
| 7 | Extension: save the prompt in a field to the account | Must |
| 8 | Synchronization: account is the truth; extension holds a refreshable copy; changes flow both ways | Must |
| 9 | Basic edit of a saved prompt from the extension | Should |
| 10 | Privacy commitments above, enforced and documented | Must |

### Out (parking lot, §9)

- Email address verification — an email is *collected*, never *validated* in the MVP
- Password reset by email (needs email delivery; not in MVP)
- Starter packs / any subscription, paid tier, or curated content
- Tags and categories
- Prompt versioning, history, diffing
- Public share links
- AI-generated titles/tags
- Team workspaces
- Offline editing, import/export, landing page

### Removed per product decision (2026-11-24)

| Removed | Reason |
| ------- | ------ |
| Starter packs | No subscription or monetization features exist; seeding content has no purpose yet. Revisit only when a paid or curated-content feature exists. |
| Email verification flow | Simple authentication is the MVP bar: email + password, no validation email. The address is stored as the sign-in identity, nothing more. |
| Pack-membership design | Not a business question. How prompts and packs relate is a technical decision made at implementation time. The business rule that *is* fixed: deleting a pack never deletes prompts. |

## 4. What the clone study contributes

`CLONE_SPEC.md` describes a mature prompt-management web app. It is a menu, not a mandate: we adopt
the behaviors that serve the MVP, keep the rest as reference for later, and drop what fights our
principles.

| Clone-spec behavior | Verdict | Reason |
| ------------------- | ------- | ------ |
| Email + password sign-in, sessions, protected routes | **Adopt** (simplified) | Minimum viable account; no verification, no social login |
| Prompt list with search, filters, pagination, empty states | **Adopt** (simplified) | Core of management; we keep search + pack filter only |
| Prompt create/edit/delete with confirmation flows | **Adopt** | Table stakes |
| Editor with Markdown preview and auto-save | **Adopt** | The right editing feel; save failures must be *surfaced*, never silent |
| Libraries of prompts (= our packs) | **Adopt** (simplified) | Named groups; we skip the reference product's tag/category filtering in the picker |
| 404 pages for missing or foreign items | **Adopt** | Honest, simple, proven |
| Dashboard shell: top bar, sidebar, dark mode | **Adopt** (reference) | Sound information architecture for the management surface |
| Tags, categories | **Later** | Packs cover MVP organization |
| Versioning, release, compare | **Later** | Not needed to prove the sync loop |
| Public share links, "save to wallet" | **Later** | Growth features, not core |
| AI metadata generation | **Later** (rethought) | If ever built, it can run on-device on the extension rather than as a server feature |
| Example usage / output sections | **Later** | Beyond the library's MVP shape |
| Duplicate prompt button | **Later** | Cheap convenience, not worth the scope now |
| Workspaces, teams, plans, tier limits, trials | **Later** | Single personal account in MVP |
| Product analytics / RUM beacons | **Drop** | Conflicts with the no-telemetry principle |
| Password reset / change-email flows | **Later** | Password *change* stays; email-dependent flows need email delivery first |

### Gaps the clone study cannot answer

The reference product is web-only. The MVP's hardest questions are exactly the ones it never faced:

1. **The extension-side experience** — where sign-in lives, how the library surfaces in the chip
   flow, how a prompt gets into a page field, how saving works. Designed in §6.
2. **Synchronization** — refresh, offline, and what happens when two devices edit the same prompt.
   Defined at behavior level in §5.
3. **Dual mode** — a product that is local-only for some users and cloud-synced for others. The
   reference product has no local mode at all.
4. **Data lifecycle** — what sign-out removes, what an account means for the user's data. §6,
   Journey D.

## 5. Product shape

### Surfaces and their one job

| Surface | Owns | Never does |
| ------- | ---- | ---------- |
| **Web dashboard** | The whole management experience: account, prompts, packs | Duplicate the extension's on-page behaviors |
| **Browser extension** | The in-flow experience: sign in, pick a prompt, save a prompt | Become a management UI — editing the library's structure stays on the dashboard |
| **Backend service** | Accounts, the library, the truth | Anything on-page; any AI; any content processing |
| **Shared definitions** | One common language for what a user, prompt, and pack *are*, so all surfaces agree | Any behavior — definitions only |

The repository becomes a single workspace holding these apps side by side plus the shared
definitions package. The reorganization itself is Epic 1 and changes nothing the user can see.

### How the surfaces relate

- **One service, two clients.** The dashboard and the extension are both clients of the same
  backend. The dashboard is always live — it manages the truth directly. The extension works from a
  local copy that it refreshes.
- **No background service is planned.** Nothing in the MVP needs work to happen outside a user's
  request. If a genuine background need appears later, it becomes its own app then.
- **Public landing page: deferred.** The dashboard itself serves sign-up and sign-in until a real
  marketing page is worth building.
- **What synchronization means, in behavior terms:**
  - Pull on sign-in and on refresh; the user can always force a refresh.
  - Push immediately after the extension saves or edits something.
  - Offline, the library is **read-only**: inserting saved prompts works, editing and saving are
    disabled with a clear message. (An offline edit queue is a parking-lot item, not MVP.)
  - If something changed on another device since the extension's copy was made, the save is
    refused with an honest "updated elsewhere — review and retry" message. The account is the
    truth; the extension never silently overwrites a newer change.
  - Deletions on the dashboard reach the extension on the next refresh.

## 6. User journeys

### Journey A — the user who never signs in (regression guard)

1. Install the extension and use the chip exactly as today: focus, rewrite, preview, replace.
2. No sign-in prompt interrupts the flow. The only visible difference is one "My Prompts" rail item
   leading to a sign-in screen — and only after it is opened.
3. Every existing behavior is unchanged: model download flow, undo, history, translation.

**Acceptance:** a long-time user cannot tell the extension was updated, until they go looking.

### Journey B — end to end (the MVP proof)

1. Install the extension; everything works locally (Journey A).
2. Open the dashboard; sign up with email and password. No verification email arrives or is needed.
3. Create a pack, "Writing". Create prompts with a title and Markdown text. Edit, delete, search.
4. Open the extension popup → Account → sign in. The library syncs; the popup says how much synced.
5. On any page, focus a field → chip → rail → **My Prompts** → search → pick a prompt.
6. The prompt lands in the editable preview — the same preview, the same Replace/Dismiss as a
   rewrite. Nothing new to learn.
7. Write a new prompt in a field → rail → **Save prompt** → give it a title → saved.
8. The dashboard already shows it. Edit it there; the extension gets the new text on its next
   refresh.
9. Sign out from either surface. The extension's local copy is removed. Journey A is what remains.

### Journey C — two devices, one library

1. Signed in on the dashboard at home and the extension at work.
2. Edit a prompt on the dashboard; save.
3. In the extension, edit the same prompt from a copy made before that change.
4. The extension refuses the save: "This prompt was updated elsewhere — review and retry," showing
   the current text. The newer change is never lost or silently overwritten.

### Journey D — leaving (privacy, made concrete)

1. Sign out of the extension. Prompts, packs, and sign-in credentials leave this computer.
2. The chip and the nine actions keep working — they never depended on the account.
3. The account and its library remain on the dashboard, reachable by signing in again.

```
 Journey B, step by step:

 dashboard                          extension                     any page
 ─────────                          ─────────                     ────────
 sign up ──► create pack ──►
 create/edit/delete prompts ──► sign in ──► sync ──► rail "My Prompts"
                                    │                            │
                                    │   save prompt in a field ◄──┘
                                    │      │
 refresh ◄────── pushed save ◄──────┘      insert into preview ──► Replace
```

## 7. Epics, stories, tasks

Priorities: **P0** must-have for MVP · **P1** should-have · **P2** parking lot.
Every acceptance criterion below is observable by a user, not by a developer.

### Epic 1 — Workspace foundation

**Goal:** one repository that can hold the dashboard, the backend, and the extension side by side,
with the extension behaving exactly as before.
**User journey:** none visible — this epic is the regression guard for Journey A.
**Priority:** P0 · **Dependencies:** none.

| Story | Tasks | Acceptance criteria |
| ----- | ----- | ------------------- |
| 1.1 Reorganize into a workspace | Define the app/package layout; move the extension into its slot; create the shared-definitions package shell; keep the verify pipeline meaningful at the workspace level; update contributor docs to the new layout; remove stale build artifacts from the repo | Every existing check passes in the new layout; the built extension loads and behaves identically; a contributor following the docs lands in the right places |

### Epic 2 — Accounts & simple authentication

**Goal:** a person can have an account and be signed in, on the web and in the extension.
**User journey:** B steps 2 and 4; A untouched.
**Priority:** P0 · **Dependencies:** Epic 1.

| Story | Tasks | Acceptance criteria |
| ----- | ----- | ------------------- |
| 2.1 Register | Sign-up form (email, password, name); friendly duplicate-email error; immediate sign-in on success | An account exists and the user is signed in; **no email is sent** — not a welcome mail, not a validation mail |
| 2.2 Sign in / sign out / session | Sign-in form with return-to-where-you-were; clear wrong-credentials error; sign-out; graceful session expiry | Protected pages redirect anonymous visitors to sign-in and back after; wrong credentials show one honest error; sign-out ends access everywhere on that surface |
| 2.3 Change password | Current-password + new-password form on the dashboard | Wrong current password is rejected; the new password works on the next sign-in |
| 2.4 Sign in from the extension | Sign-in screen in the extension settings; stays signed in across browser restarts; sign-out control | Signing in from the extension works with the same credentials as the web; wrong credentials show an inline error; signing out returns the extension to local-only |

### Epic 3 — Prompt management (dashboard)

**Goal:** full control of prompts on the web.
**User journey:** B step 3.
**Priority:** P0 · **Dependencies:** Epic 2.

| Story | Tasks | Acceptance criteria |
| ----- | ----- | ------------------- |
| 3.1 Create & view | New-prompt form: required title, Markdown text; sanitized rendered preview; per-user privacy | The prompt appears in the list; one user can never open another user's prompt (not-found page, not an error) |
| 3.2 List & find | Paginated prompt cards with Markdown preview; text search; pack filter; clear-filters; empty and no-result states with guidance | Search matches title and text; filtering by pack shows only that pack; empty states guide the first action |
| 3.3 Edit & auto-save | Prompt page with editor + live preview; saves automatically shortly after typing stops; visible save state; failures surfaced | Edits persist without pressing a save button; the user always knows whether their text is saved; a failed save is shown, never silently swallowed |
| 3.4 Delete | Confirmation page naming the prompt and warning it cannot be undone | The deleted prompt is gone from lists, packs, and its own URL |

### Epic 4 — Prompt packs (dashboard)

**Goal:** prompts organized into named packs.
**User journey:** B step 3 (packs half).
**Priority:** P0 · **Dependencies:** Epic 3.

| Story | Tasks | Acceptance criteria |
| ----- | ----- | ------------------- |
| 4.1 Pack management | Create, rename, delete packs; name required; deletion is confirmed first | **Deleting a pack never deletes the prompts in it** — they remain in "All prompts"; a pack needs a name |
| 4.2 Prompts in packs | Add prompts to a pack (from the pack page and the prompt page); remove them from a pack; prompt counts per pack | A prompt can be found in its pack and in the main list; counts are correct after add/remove |
| 4.3 Pack view | Pack page listing its prompts, opening any of them | Navigating pack → prompt → back keeps the user oriented |

No starter packs. The new-account experience is an honest empty state with a clear "create your
first prompt" step instead of seeded content.

### Epic 5 — Extension library access

**Goal:** the signed-in extension can use the library on any page.
**User journey:** B steps 4–6; A untouched for signed-out users.
**Priority:** P0 · **Dependencies:** Epics 2–4.

| Story | Tasks | Acceptance criteria |
| ----- | ----- | ------------------- |
| 5.1 Library sync | After sign-in, bring the library to the extension; keep a local copy; refresh on demand and when stale; show sync status | The library is usable in the extension right after sign-in; a change made on the dashboard appears after refresh; the library is readable offline |
| 5.2 Prompt picker | "My Prompts" rail item (signed-in only); picker with search and packs; picking inserts into the existing editable preview | Insert flows through the same preview-and-Replace the user already knows; the picker searches by title; the rail item does not exist for signed-out users |
| 5.3 Sign out wipes | Sign-out removes the local copy and credentials | After sign-out, no prompt content remains on the computer; the extension works as Journey A |

### Epic 6 — Save & sync from the extension

**Goal:** the extension is a first-class way to grow the library, from the page itself.
**User journey:** B steps 7–8; C.
**Priority:** P0 (6.3), P1 (6.2) · **Dependencies:** Epic 5.

| Story | Tasks | Acceptance criteria |
| ----- | ----- | ------------------- |
| 6.1 Save prompt | Rail action "Save prompt"; title step; first-ever save shows a one-time notice that the prompt will be stored in the account; push on save | The saved prompt appears on the dashboard with the given title; saving is always explicit — field text is never captured without the action; the first-save notice appears once, then never again |
| 6.2 Edit from the extension | Edit title/text of a saved prompt from the picker | The edit reaches the dashboard; the extension's copy matches afterwards |
| 6.3 Conflicts & errors | Refuse stale saves with the "updated elsewhere" message; network failures offer retry; nothing silent | A save against a newer server copy is refused and explained; the newer text survives; offline saves are disabled with a clear read-only message |

### Epic 7 — End-to-end hardening & MVP release

**Goal:** Journey B is true for a stranger, on real infrastructure, with honest documentation.
**User journey:** all of them, in order.
**Priority:** P0 · **Dependencies:** all above.

| Story | Tasks | Acceptance criteria |
| ----- | ----- | ------------------- |
| 7.1 Journey verification | Walk all four journeys against a real build; fix what breaks | B steps 1–9 pass end to end; A passes with zero regression; C and D behave exactly as written |
| 7.2 Privacy commitments, enforced | Verify each §2 principle is observable: local-only default, opt-in save, one-time notice, sign-out wipe, no content in server logs; update product documentation to describe sync honestly | Each principle can be demonstrated to a non-developer; the docs never overstate privacy or understate what sync stores |
| 7.3 Release readiness | Deploy the service; version and release the extension; a permission-change explanation users can read in one sentence | A person who has never heard of Promptizer can sign up and complete Journey B unassisted |

## 8. Roadmap

```text
Phase 0   Epic 1        the workspace exists; nothing user-visible changes   ── M0 "same product, new shape"
Phase 1   Epics 2–4     accounts, prompts, packs — the web library works    ── M1 "a complete manager on the web"
Phase 2   Epics 5–6     sign in, pick, save — the library is in the browser ── M2 "the library rides along"
Phase 3   Epic 7        hardening, privacy proof, release                    ── M3 "MVP shipped"
          ── then, one slice at a time ── the parking lot
```

- Each phase ends at a milestone that is demonstrable on its own: M1 is a complete prompt manager
  even with no extension installed; M2 is the full loop; M3 is public.
- Epics 2–4 build strictly in order; Epic 5 can start as soon as the account surfaces of Epic 2
  exist, using a stand-in library while Epics 3–4 catch up.
- One epic at a time on one branch per change, per the repo's working rules.

## 9. Parking lot (post-MVP, in rough order of value)

| Item | Why later |
| ---- | --------- |
| Versioning, history, diff | Valuable once the library is real and used hard; not needed to prove the loop |
| Tags & categories | The first growth of the organizing model once packs feel tight |
| Password reset by email | Needs email delivery, which the MVP deliberately avoids |
| Public share links | Growth feature; deserves its own design pass |
| Offline edit queue | The classic scope trap; read-only offline is honest and enough for MVP |
| Import/export (JSON) | Trust and lock-in relief once there is something worth exporting |
| Anonymous local packs | Saving without an account; complicates the "server is truth" rule |
| AI metadata (title/tags) on-device | A Promptizer-shaped twist on the reference product's server feature; needs the library first |
| Landing page | Marketing, once the product is worth marketing |
| Duplicate prompt, example usage/output | Conveniences, in the reference product's order of value |
| Team workspaces, plans | Only when there is a reason to charge |
| Starter packs | **Removed from MVP.** Only when a subscription or curated-content feature exists |
| Account deletion self-service | Expected by users once accounts are public; early-beta kindness first |

## 10. Open product questions

These stay open on purpose; none blocks starting Phase 0.

1. **Landing page timing** — recommendation: defer until after M3.
2. **Offline editing** — recommendation: read-only for MVP (already scoped so).
3. **Sign-out "keep a local copy?" option** — recommendation: no; wipe, for a promise that is simple
   to state and verify.
4. **Save entry points in the extension** — rail action plus a save affordance on the rewrite
   preview, or rail action only for MVP?
