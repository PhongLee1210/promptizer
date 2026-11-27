# Promptizer MVP — loop status ledger

Driven by `/mvp-loop` (`.claude/commands/mvp-loop.md`), every 2 hours. States: READY · IN-PROGRESS · NEEDS-REVIEW · VERIFIED · FAILED · BLOCKED-DECISION · PENDING (deps not met) · DONE (verified before loops started).

## Next loop

1. Epic 3 work already landed on `main` (prompt contract, CRUD API, pages, markdown, auto-save, E2E) but the plan has none of it ticked. Verify every Epic 3 task against its checklist, tick what passes, and turn gaps into tasks. Known gap to check: T-3.0.1 requires pack fields; `main` has categories, not packs.
2. T-1.1.7 manual Journey A smoke (load the built extension, chip appears, one rewrite works).
3. Then start the critical path at the first task that is not VERIFIED.

## Open findings

_none yet_

## Tasks

| Task | Title | Type | ⇉ | State | Branch | Base | PR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-1.1.1 | Workspace layout & orchestration decision | decision |  | DONE | | | |
| T-1.1.2 | Scaffold the workspace root | infra |  | DONE | | | |
| T-1.1.3 | Move the extension into its app slot | infra |  | DONE | | | |
| T-1.1.4 | Shared-definitions package shell | infra | ⇉ | DONE | | | |
| T-1.1.5 | Contributor docs point at the new layout | docs | ⇉ | DONE | | | |
| T-1.1.6 | Remove stale artifacts | debt | ⇉ | DONE | | | |
| T-1.1.7 | Full workspace verify pass | qa |  | NEEDS-REVIEW | | | |
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
| T-3.0.1 | Prompt & pack data-shape decision | decision |  | NEEDS-REVIEW | | | |
| T-3.0.2 | Prompt persistence, owner-scoped | infra |  | NEEDS-REVIEW | | | |
| T-3.1.1 | Markdown rendering & sanitization decision | decision |  | NEEDS-REVIEW | | | |
| T-3.1.2 | Markdown preview helper | feat |  | NEEDS-REVIEW | | | |
| T-3.1.3 | Create-prompt endpoint | feat |  | NEEDS-REVIEW | | | |
| T-3.1.4 | New-prompt page | feat | ⇉ | NEEDS-REVIEW | | | |
| T-3.1.5 | Prompt view page | feat | ⇉ | NEEDS-REVIEW | | | |
| T-3.1.6 | Ownership isolation tests | test | ⇉ | NEEDS-REVIEW | | | |
| T-3.2.1 | List endpoint | feat |  | NEEDS-REVIEW | | | |
| T-3.2.2 | Prompt list page | feat | ⇉ | NEEDS-REVIEW | | | |
| T-3.2.3 | Search & pack filter controls | feat |  | NEEDS-REVIEW | | | |
| T-3.2.4 | Empty & no-result states | feat | ⇉ | NEEDS-REVIEW | | | |
| T-3.2.5 | List tests | test | ⇉ | NEEDS-REVIEW | | | |
| T-3.3.1 | Update endpoint | feat |  | NEEDS-REVIEW | | | |
| T-3.3.2 | Editor page with live preview | feat |  | NEEDS-REVIEW | | | |
| T-3.3.3 | Auto-save client | feat |  | NEEDS-REVIEW | | | |
| T-3.3.4 | Auto-save tests | test | ⇉ | NEEDS-REVIEW | | | |
| T-3.4.1 | Delete endpoint | feat |  | NEEDS-REVIEW | | | |
| T-3.4.2 | Delete confirmation flow | feat | ⇉ | NEEDS-REVIEW | | | |
| T-3.4.3 | Delete tests | test | ⇉ | NEEDS-REVIEW | | | |
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
