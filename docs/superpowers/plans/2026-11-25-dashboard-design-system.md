# Dashboard design system & shell — plan

Date: 2026-11-25
Status: draft, awaiting review
Reference: `docs/features/CLONE_SPEC.md` §10 (design system), read as a structural reference only.
Feeds: Epic 3 and Epic 4 UI tasks in `2026-11-24-promptizer-mvp-task-breakdown.md`.

## Decisions (owner, 2026-11-25)

- **Theme:** keep the Promptizer `--pz-*` identity (blue accent) and add a light mode. Borrow only structure and
  metrics from the reference: 4 px grid, 10 px base radius, type scale, component sizes.
- **Fidelity:** same functional structure (top bar, sidebar, card grid), our own visuals for the signature pieces.
- **Scope:** design system, app shell, prompt list and editor, packs. Sharing, versions and AI metadata are out.

## Clean-room rules

- Reuse only facts that are generic (spacing, radius, sizes, layout roles). No copy text, fonts, icons, images or class
  names from the reference product.
- Do not reproduce its distinctive visuals: gradient header band on cards, gradient Create button with tilting icon
  tile, purple feedback link, promo card.
- Do not reproduce its defects: duplicate on GET, silent auto-save failures, unused fonts, eager heavy bundles,
  invalid color expressions, undefined classes (spec §12).
- `CLONE_SPEC.md` was derived partly from the reference product's public bundle and source map and names a third-party
  product. Keep it out of the public repository history; the evidence bundle it mentions holds personal data and must
  never be committed.

## Mapping of the reference foundations to ours

| Reference (spec §10)                        | Ours                                                                                          |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 4 px spacing grid                           | Already `--pz-space-*`; Tailwind default spacing matches                                      |
| Base radius 10 px (6/8/10/14/16)            | `--radius: var(--pz-radius-medium)` (currently small, 8 px) and derived sm/md/lg/xl           |
| Neutral palette, light + dark               | `--pz-*` semantic colors for dark; add a light block, same token names                        |
| Dark mode from stored switch, ignores OS    | Default to OS preference, stored override wins; inline pre-paint script to avoid flash        |
| Satoshi + Phosphor, plus two unused fonts   | Inter via `next/font` (self-hosted, one family, used weights only) + `lucide-react`           |
| Type scale 12/14/16/18/20/24, weights 4/5/6 | Same scale in the dashboard; inputs 16 px on mobile to prevent zoom                           |
| Button 3 sizes × 6 styles, badge, input…    | shadcn components already installed (button, input, label, card, field, alert) plus the below |
| Sticky 48 px top bar, 256 px sidebar        | shadcn `sidebar` block: collapsible, mobile sheet, persisted state                            |

## Tasks

Estimates in hours, each including its own checks. Backend dependencies refer to the breakdown plan.

**D-1 · Tokens: radius, type scale, light mode, no-flash theme switch** · 2.5h · after: —

- [ ] `packages/ui/tokens.css` gains a light block with the same semantic names; the extension stays dark-only
- [ ] `apps/web` maps shadcn variables to both modes; radius derived from the 10 px base
- [ ] Theme follows the OS by default, a stored choice overrides, no flash on first paint
- [ ] Contrast of text, muted text, borders and focus ring checked in both modes

**D-2 · Component set and font** · 2h · after: D-1

- [ ] Add via the shadcn CLI: badge, textarea, select, dropdown-menu, dialog, sheet, tooltip, skeleton, pagination,
      breadcrumb, switch, checkbox, sonner (toast), sidebar
- [ ] Inter loaded through `next/font`; no external font requests at runtime
- [ ] `lucide-react` added only when first used; no unused dependency left in `package.json`

**D-3 · App shell** · 3h · after: D-2

- [ ] Top bar with global search (submits to the list with `q`), sidebar toggle and user menu (account, sign out)
- [ ] Sidebar: primary "New prompt" action, All prompts, Prompt packs, collapsible Packs section with counts
- [ ] Mobile: sidebar becomes a sheet; keyboard and focus behavior verified
- [ ] Sidebar section open/closed state persists per browser; storage failures degrade silently
- [ ] Replaces the current centered auth-card layout for signed-in pages; sign-in and sign-up keep their own layout

**D-4 · Page patterns** · 1.5h · after: D-3

- [ ] Page header (title + count pill + actions), empty state, no-results state, not-found page, loading skeletons
- [ ] Every state offers a next action (no dead ends)

**D-5 · Prompt card and grid** · 2h · after: D-4, T-3.0.2

- [ ] Card: title, rendered preview clamped to a fixed line count, chips for pack and metadata, whole card is a link
- [ ] Our own look: flat surface, border, subtle hover elevation; no gradient header
- [ ] 1 column on mobile, 2 from `md`, 3 from `xl`; hover and focus states keyboard-visible

**D-6 · List, search, filters, pagination UI** · covered by T-3.2.2, T-3.2.3, T-3.2.4 · after: D-5, T-3.2.1

- [ ] Built from the D-4/D-5 patterns; URL carries the filters

**D-7 · Editor with preview** · covered by T-3.3.2, T-3.3.3 · after: D-4, T-3.3.1

- [ ] Split textarea and live preview with a toggle, character count, save state (saving / saved / failed)
- [ ] Failed saves are shown with a retry; nothing fails silently
- [ ] Optional, decided at T-3.1.1: render paired non-HTML tags (prompt XML blocks) as labelled blocks

**D-8 · Packs UI** · covered by T-4.1.2, T-4.2.2, T-4.3.1, T-4.3.2 · after: D-3, T-4.1.1

- [ ] Sidebar section, pack page and membership pickers use the same patterns

**D-9 · Visual and accessibility pass** · 1.5h · after: D-5, D-7

- [ ] Light and dark at 375, 768 and 1280 px captured with Puppeteer and reviewed
- [ ] Keyboard-only walk of shell, list, editor; visible focus everywhere; labels on every control
- [ ] Production build size checked; markdown and syntax-highlighting code is not in the list page bundle

Total for D-1 to D-5 and D-9: 12.5h; D-6 to D-8 are inside the Epic 3 and 4 estimates.

## Dependencies and risks

- Epic 3 and 4 backends need persistence in Supabase Postgres with owner-scoped row access (T-3.0.1, T-3.0.2). Decide
  the schema and row-level-security approach before D-5.
- T-3.1.1 picks the Markdown renderer and sanitizer. Lazy-load it; do not ship diagram or math rendering in the MVP.
- Any new dependency needs owner approval under AGENTS.md; the shadcn components listed above are the only additions
  this plan assumes.
- The shared `tokens.css` is also loaded by the extension; D-1 must not change the extension's rendering (E2E suite
  stays green).
