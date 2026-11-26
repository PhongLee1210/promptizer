# Web Desktop Template Adoption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/web` desktop look and be organised like `next-shadcn-admin-dashboard`, with Promptizer's blue as a theme preset and our existing features running inside it.

**Architecture:** Vendor the template's UI foundation (components/ui, styles, preferences store, theme boot, dashboard shell) into `apps/web`, drop its demo screens, and mount our existing screens inside the shell. Keep current URLs (`/`, `/prompts`, `/prompts/new`, `/account/password`, `/sign-in`, `/sign-up`) so the proxy mobile split, `lib/device.ts` and the e2e paths do not change. The `/m` tree stays as is and is only kept working.

**Tech Stack:** Next 16, React 19, Tailwind 4, shadcn (radix-nova), pnpm workspace, Puppeteer e2e.

**Spec:** `docs/superpowers/specs/2026-11-26-web-template-adoption-design.md`

## Global Constraints

- pnpm only; run from repo root, per-app via `pnpm -C apps/web`. Never `npm`/`npx`.
- Prettier (2 spaces, semicolons, double quotes, trailing commas, printWidth 120); `import type` for types.
- No comments in code. No Biome, husky, lint-staged, ts-node.
- Commit messages: one line, `type: description`. Branch `feature/web-template-adoption`; one commit per task.
- Do not edit `apps/chrome-extension/**`, `packages/ui/tokens.css` (extension still loads it).
- Do not edit template `src/components/ui/**` after vendoring; customise at use sites or via the preset.
- Next 16 differs from training data: read the relevant guide in `apps/web/node_modules/next/dist/docs/` before touching Next APIs.
- Not shipped from the template: Google tag / gtag script, `data/users`, fake account switcher, GitHub links/star button, support card, demo screens and their data, analytics/social-auth buttons.
- Not added dependencies: recharts, fullcalendar, dnd-kit, d3-geo, topojson-client, simple-icons, shiki, embla, react-day-picker, react-resizable-panels, temporal-polyfill, date-fns, input-otp, biome, husky, ts-node.
- Primary colour source: current `--primary: oklch(0.55 0.2 262)`; ring `oklch(0.65 0.14 262)`.
- Keep an MIT credit for the template.
- Packs feature is removed entirely (desktop and mobile routes, views, sidebar and shell entries, `MOBILE_SPLIT_ROUTES` entry, prompt-card pack chip, tests, e2e). Only prompt management and auth remain.
- Brand: the template's logo/app name are replaced by the existing `BrandLogo` (`public/logo.png`, "Promptizer").
- Auth stays per page in `components/desktop/app-page.tsx` via `requireSignedInUser(path)`, never in layouts (return-to deep links). `components/desktop/**` is never imported by mobile or shared code (`tests/device-architecture.test.ts`).
- Use Serena symbol tools for navigation, reference checks and edits of existing code; update Serena memories `web_theme` and `web_device_split` at the end.

## Review Focus

- First paint with stored dark mode and with OS-light default shows no flash and no wrong-theme frame (desktop and `/m`).
- Anonymous visit to any desktop screen still redirects to sign-in with return-to; signed-in visit to sign-in redirects away.
- Mobile user agent still lands on `/m/*` equivalents and the mobile theme toggle still switches theme.
- Sidebar collapsed state survives reload; layout does not shift on first paint.
- Sign-out and expired-session mid-action (existing journeys) still end at sign-in.
- No request to Google Tag Manager or any third-party host at runtime.

## File Structure

```
src/app/layout.tsx                         template root layout (preferences provider, boot script, fonts, Toaster)
src/app/globals.css                        template CSS + promptizer preset import
src/styles/presets/promptizer.css          primary colour preset (light + dark)
src/lib/preferences/{theme,layout,preferences-config,preferences-storage,preference-runtime,theme-utils}.ts   template
src/lib/fonts/registry.ts                  template, trimmed to Inter + Geist families used
src/lib/{cookie.client,local-storage.client}.ts   template
src/server/server-actions.ts               template (preferences cookies)
src/stores/preferences/*                   template
src/scripts/theme-boot.tsx                 template
src/config/app-config.ts                   Promptizer name, url, meta, copyright
src/navigation/sidebar/sidebar-items.ts    Promptizer nav groups
src/components/ui/*                        template's (replaces current 21)
src/app/(desktop)/layout.tsx               template dashboard layout, session-guarded
src/app/(desktop)/_components/{sidebar,header}/*   template shell with Promptizer content
src/app/(desktop)/**/page.tsx              unchanged URLs, bodies use template patterns
src/app/(auth)/{sign-in,sign-up}/...       template auth layout hosting our auth-form
```

---

### Task 1: Foundation, theme preset and root layout

**Files:**
- Create: everything under "template" and `promptizer.css`, `app-config.ts` above
- Modify: `apps/web/package.json`, `apps/web/components.json`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/theme-toggle.tsx`, `src/hooks/use-theme-mode.ts`
- Delete: `src/lib/theme.ts` after nothing imports it

**Interfaces:**
- Produces: `PreferencesStoreProvider`, `usePreferencesStore`, `getPreference(key)`; `data-theme-mode`/`data-theme-preset` attributes on `<html>`; `APP_CONFIG: { name, url, version, copyright, meta }`; `ThemeToggle` (mobile-facing, same export name) now driven by the preferences store; `useThemeMode(): "light" | "dark"` unchanged signature.

- [ ] **Step 1: Create branch and clone the template for reading**

```bash
git checkout -b feature/web-template-adoption
git clone --depth 1 git@github.com:arhamkhnz/next-shadcn-admin-dashboard.git <scratchpad>/template
```
The clone is outside the repo; never commit it.

- [ ] **Step 2: Write the failing e2e check**

In `apps/web/e2e/run.mjs` add journey `themeJourney(browser)`: load `/sign-in`, assert `document.documentElement.dataset.themePreset === "promptizer"` and `dataset.themeMode` is `light` or `dark`; click the theme toggle on `/m` with a mobile user agent after sign-in is not needed, so assert only on `/sign-in`; reload and assert `themeMode` persists after toggling via `localStorage`/cookie-backed preference (toggle on sign-in is not available, so set cookie `theme_mode=dark` and reload, assert `themeMode === "dark"` and computed `body` background is not white). Register it in the journey list.
Run: `pnpm -C apps/web test:e2e` → FAIL (`themePreset` undefined).

- [ ] **Step 3: Add dependencies with the approved list**

`pnpm -C apps/web add zustand @base-ui/react @shadcn/react shadcn tw-animate-css geist cmdk @tanstack/react-table react-hook-form @hookform/resolvers zod vaul` (versions from the template's `package.json`, alongside already present `radix-ui`, `lucide-react`, `sonner`, `class-variance-authority`, `cn`). Do not add `next-themes`: the template drives theme through its own preferences store.

- [ ] **Step 4: Vendor the foundation**

Copy from the clone into `apps/web/src`: `components/ui/*`, `styles/presets/{brutalist,soft-pop,tangerine}.css` are NOT copied (only `promptizer.css`), `lib/preferences/*`, `lib/fonts/registry.ts` (trim to Inter and Geist families), `lib/cookie.client.ts`, `lib/local-storage.client.ts`, `lib/utils.ts` (merge `cn` export with existing if different), `server/server-actions.ts`, `stores/preferences/*`, `scripts/theme-boot.tsx`, `hooks/use-mobile.ts`, `hooks/use-lg.ts`. Set `components.json` to the template's. Adapt to repo style (Prettier, no comments, `import type`). Remove template ui files that import excluded libraries (chart, calendar, carousel, input-otp, resizable, code-block).

- [ ] **Step 5: Create `styles/presets/promptizer.css`**

Selector `:root[data-theme-preset="promptizer"]` and the matching dark selector the template's presets use; `--primary: oklch(0.55 0.2 262)`, `--ring: oklch(0.65 0.14 262)`, sidebar-primary follows primary; remaining tokens neutral as in the template's default. Register it in the generated block of `lib/preferences/theme.ts` as `{ label: "Promptizer", value: "promptizer", primary: { light: "oklch(0.55 0.2 262)", dark: "oklch(0.65 0.2 262)" } }` (hand-edit the block; the generator needs ts-node) and make `promptizer` the `theme_preset` default and `dark` the `theme_mode` default only if the current app defaults to dark with no stored value; otherwise follow the template default (`light`).

- [ ] **Step 6: Replace `app/layout.tsx` and `globals.css`**

Root layout per the template (provider, `ThemeBootScript`, `Toaster`, `TooltipProvider`, fonts) with no gtag script, metadata from `APP_CONFIG`, keep `viewport: { viewportFit: "cover" }`. `globals.css` per the template with an import of `promptizer.css` only.

- [ ] **Step 7: Keep mobile working**

Rewrite `ThemeToggle` to set the theme through `usePreferencesStore` (`theme_mode` between `light` and `dark`), and `useThemeMode` to read the resolved mode from the store. Delete `lib/theme.ts` and `data-pz-mode` uses. The mobile tree must import nothing removed from `components/ui`.

- [ ] **Step 8: Verify**

Run: `pnpm -C apps/web typecheck && pnpm -C apps/web build && pnpm -C apps/web test:e2e`
Expected: typecheck and build pass; `themeJourney` passes; existing journeys pass except `desktopShellJourney` if it asserts old shell text (it is rewritten in Task 2; mark only that journey skipped until then).

- [ ] **Step 9: Commit**

```bash
git add -A apps/web pnpm-lock.yaml
git commit -m "feat(web): adopt template design system and promptizer theme preset"
```

---

### Task 2: Desktop dashboard shell (auth stays in AppPage)

**Files:**
- Create: `src/components/desktop/sidebar/{app-sidebar,nav-main,nav-user}.tsx`, `src/components/desktop/header/{search-dialog,theme-switcher,layout-controls}.tsx`, `src/navigation/sidebar/sidebar-items.ts`
- Modify: `src/components/desktop/app-page.tsx` (keeps auth and mounts the new template shell around children), `apps/web/e2e/run.mjs` (`desktopShellJourney`). Shell files live under `src/components/desktop/{sidebar,header}/` to respect the import boundary.
- Delete: `src/components/desktop/{app-shell,app-sidebar,app-page}.tsx`, `src/components/global-search.tsx`, `src/components/user-menu.tsx`, `src/hooks/use-persisted-open.ts` once unused

**Interfaces:**
- Consumes: `getPreference`, `PreferencesStoreProvider` (Task 1); existing `requirePageSession` in `lib/server/page-session.ts`; existing `useSignOut` hook; `AuthUser` from `@promptizer/shared`
- Produces: `NavGroup[]` in `sidebar-items.ts` with items: All prompts (`/prompts`), New prompt (`/prompts/new`), Account (`/account/password`); `<UserNav user={AuthUser} />` that exposes Change password and Sign out

- [ ] **Step 1: Rewrite `desktopShellJourney` first**

Assert after sign-in at 1280×800 desktop UA: sidebar nav links "All prompts", "New prompt" exist and navigate to their URLs; user menu shows the signed-in email and a "Sign out" action; theme switcher toggles `data-theme-mode`; collapsing the sidebar and reloading keeps it collapsed (cookie `sidebar_state`). Run → FAIL.

- [ ] **Step 2: Implement `(desktop)/layout.tsx`**

`AppPage` keeps calling `requireSignedInUser(path)` and then renders the template layout body (from `dashboard/layout.tsx`): `sidebar_state` cookie, `getPreference` for variant/collapsible, `AppSidebar`, `SidebarInset` and header. Header holds `SidebarTrigger`, `SearchDialog` (submits to `/prompts?q=`), `LayoutControls`, `ThemeSwitcher`, `UserNav`. No GitHub menu, no account switcher with fake users. Sidebar header shows `BrandLogo` and `APP_CONFIG.name`.

- [ ] **Step 3: Remove old shell and per-page wrappers**

Pages under `(desktop)` stop wrapping themselves in `AppPage`; delete the files listed above once `grep` shows no importers (mobile must not import them).

- [ ] **Step 4: Verify and commit**

Run: `pnpm -C apps/web typecheck && pnpm -C apps/web test:e2e` → all journeys pass.

```bash
git add -A apps/web
git commit -m "feat(web): replace desktop shell with template dashboard layout"
```

---

### Task 3: Auth pages in the template auth layout

**Files:**
- Modify: `src/app/sign-in/page.tsx`, `src/app/sign-up/page.tsx`, `src/components/auth-form.tsx`, `src/components/auth-card.tsx`
- Create: `src/app/(auth)/layout.tsx` only if the template's auth layout needs a wrapper; keep URLs `/sign-in`, `/sign-up`

**Interfaces:**
- Consumes: current `AuthForm` props and its fetch/redirect behaviour (unchanged); `safe-redirect` return-to handling

- [ ] **Step 1: Existing auth journeys are the failing tests**

Update selectors in `guardedAuthPagesAndSignInJourney`, `registrationJourney`, `duplicateRegistrationJourney` only if the heading/button names change; keep accessible names ("Email", "Password", "Sign in", "Sign up") identical so no test change is needed. Add one assertion: sign-in page contains the brand logo and a link to `/sign-up`.

- [ ] **Step 2: Restyle**

Follow `auth/v1` of the template (centered card with brand header): build the pages from `Card`, `Field`, `Input`, `Button`, `Alert` of the new ui set. Keep `AuthForm` logic (validation messages, server error display, return-to). Drop social-auth buttons.

- [ ] **Step 3: Verify and commit**

Run: `pnpm -C apps/web typecheck && pnpm -C apps/web test:e2e` → pass.

```bash
git add -A apps/web
git commit -m "feat(web): restyle sign-in and sign-up with template auth layout"
```

---

### Task 4: Remove packs; rebuild prompts, new prompt and password screens

**Files:**
- Delete (packs): `src/app/(desktop)/packs/`, `src/app/m/packs/`, `src/components/shared/packs-view.tsx`; remove `/packs` from `MOBILE_SPLIT_ROUTES` in `src/lib/device.ts`, from `tests/device.test.ts`, `tests/device-architecture.test.ts`, mobile `shell.tsx`, `prompt-card.tsx` pack chip, and `e2e/run.mjs`
- Modify: `src/components/shared/{prompts-view,new-prompt-view,change-password-view}.tsx`, `src/components/{prompt-card,prompt-grid,page-header,empty-state,no-results-state}.tsx`, `src/app/(desktop)/**/page.tsx`
- Create: `src/app/(desktop)/_components/*` only for desktop-only pieces

**Interfaces:**
- Consumes: ui `Card`, `Badge`, `Empty`, `Pagination`, `Tabs`, `Table` (+ `@tanstack/react-table` if a table view is used), `Field`, `Textarea`, `Select`; the existing view props stay unchanged because `/m` renders the same views

- [ ] **Step 1: Failing journey**

Extend `desktopShellJourney` (no new journey): empty state on `/prompts` shows a "New prompt" action that goes to `/prompts/new`; `/packs` returns not-found; `/account/password` page shows heading "Change password". Run → FAIL where headings differ.

- [ ] **Step 2: Restyle the shared views with template patterns**

Page header (title, count badge, actions), cards for prompts, `Empty` component for empty/no-results, template form fields on new prompt and password. Views remain responsive and renderable inside the mobile shell.

- [ ] **Step 3: Verify, including mobile**

Run: `pnpm -C apps/web typecheck && pnpm -C apps/web test:e2e`; `mobileShellJourney` and `deviceSplitJourney` must pass unchanged.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): rebuild prompt and account screens, remove packs with template patterns"
```

---

### Task 5: Cleanup, credit and full verification

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml`, `README.md` or create `apps/web/THIRD_PARTY.md`
- Delete: unused components, hooks, ui files and dependencies

- [ ] **Step 1: Prune**

For every dependency and `components/ui` file, `grep` for importers; remove those unused (`pnpm -C apps/web remove <pkg>`). Confirm none of the excluded libraries is present and `grep -ri "googletagmanager\|gtag" apps/web/src` is empty.

- [ ] **Step 2: Credit**

Add `apps/web/THIRD_PARTY.md` with the template name, URL, MIT licence text and copyright holder, and mention it in `docs/architecture.md` web section.

- [ ] **Step 3: Verify**

Run: `make verify` → typecheck, prettier, build, E2E all pass. Run `pnpm -C apps/web dev` and open `/sign-in`, `/prompts`, `/m/prompts` (mobile UA) in light and dark for the owner's visual review.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(web): remove superseded UI code, prune dependencies, credit template"
```

---

## Self-review

- Spec coverage: structure, theme preset, mobile kept working, dependency list, MIT credit, e2e updates, anti-goals (no leftovers, no override-per-component) all map to Tasks 1–5. Desktop URL scheme: kept current URLs (builder call recorded in Architecture).
- Deviation from spec: spec named `next-themes`; the template uses its own preferences store, so `next-themes` is not added. Spec's "ui: keep all" is narrowed to remove files needing excluded libraries.
- Interfaces consistent: `ThemeToggle` and `useThemeMode` keep their names across Tasks 1 and 2; `NavGroup` defined in Task 2 only.
