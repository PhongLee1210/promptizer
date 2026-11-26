# Web desktop: adopt next-shadcn-admin-dashboard — design

Date: 2026-11-26
Status: draft, awaiting owner approval
Source template: https://github.com/arhamkhnz/next-shadcn-admin-dashboard (MIT)

## Intent and why

Building features in `apps/web` is slow because the UI and design system are hand-rolled. The template already ships a
complete desktop dashboard: theme system, design tokens, layout, sidebar, header, data-table patterns and auth pages.
Adopt it as the base of the desktop web app so new work is only content and logic, not styling.

## Goals

- Desktop web looks and is organised like the template: its `components/ui`, styles, theme presets, preferences store,
  dashboard layout (header, sidebar, nav-user, search dialog, theme and layout switchers) and auth page layouts.
- Promptizer's primary colour is applied through a Promptizer theme preset, not by editing template components.
- Existing Promptizer features run inside the template structure: sign-in, sign-up, prompts, new prompt, packs, change
  password. Server code and behaviour are unchanged.
- Template conventions are followed for new code: route-co-located `_components/`, `navigation/sidebar/sidebar-items.ts`,
  `config/app-config.ts`.

## Non-goals

- No redesign of the template's look beyond the primary colour and logo.
- No new features. No change to the API, Supabase code, auth flow or the extension.
- Mobile redesign is not part of this change (see Mobile).

## Anti-goals

- Wholesale copy that leaves demo screens, unused dependencies or dead code behind.
- Switching the repo's tooling to the template's (npm, Biome, husky).
- A result that needs per-component overrides to look like Promptizer instead of a preset.

## Constraints

- AGENTS.md: pnpm only, Prettier, no code comments, `import type`, one change per branch, ask before adding
  dependencies or moving files. This design is the request for that approval; the dependency list below is what is asked.
- E2E (Puppeteer) is the test strategy; existing `apps/web/e2e/run.mjs` journeys are updated, not replaced with unit
  tests.
- MIT licence: keep the template's copyright notice (a short credit file or README section).
- Mobile tree and device routing keep working throughout.

## Approaches considered

| Approach                                       | Trade-off                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **A. Template as base, port our logic in**     | Largest diff; afterwards styling cost is near zero and structure matches upstream. Chosen. |
| B. Cherry-pick shell and theme into current UI | Smaller diff, but a hybrid that does not match the template and keeps the styling work.    |

Owner chose A, with the mobile tree kept and designed separately.

## Design

### Target structure (desktop)

```
src/app/(main)/dashboard/
  layout.tsx                       template shell (sidebar + header)
  _components/{sidebar,header}/    template files, nav items and branding swapped
  prompts/page.tsx  _components/   from shared/prompts-view, prompt-card, prompt-grid
  prompts/new/page.tsx _components/
  packs/page.tsx    _components/
  account/password/page.tsx _components/
src/app/(main)/auth/...            template auth layout; our auth-form, auth-card logic inside
src/components/ui/                 template's components (replace current 21)
src/styles/presets/promptizer.css  primary colour, registered like the template's presets
src/config/app-config.ts           app name, logo
src/navigation/sidebar/sidebar-items.ts   Prompts, New prompt, Packs, Account
src/stores/preferences, src/lib/preferences   template theme/layout preferences
```

Route paths: desktop URLs may move under `/dashboard/...` as in the template. The proxy's mobile split and
`isMobileSplitRoute` must be updated to the final paths. The exact desktop URL scheme is the builder's call, as long as
mobile redirects keep working both ways.

### Theme

Replace `data-pz-mode` / `PRE_PAINT_THEME_SCRIPT` / `use-theme-mode` with the template's `next-themes` and preferences
store for the desktop tree. The Promptizer blue is expressed as a template preset. `packages/ui/tokens.css` stays because
the extension loads it; the web app stops importing it for the desktop tree.

### Mobile

The `/m/*` tree, `components/mobile/*` and `lib/device.ts` stay. It will be designed on its own later. In this change it
only has to keep building and working on the replaced `components/ui` (it uses button, sheet and input) and the new theme
mechanism; `theme-toggle`, `brand-logo` and the `shared/*-view` components it imports must remain usable by it or be
moved with it. Restyling mobile is out of scope.

### Dependencies (approval requested)

Add only what the kept template parts import, expected: `next-themes`, `zustand`, `@base-ui/react`, `cmdk`,
`@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`, `zod`, `vaul`, `geist` (template font),
`tw-animate-css`, plus any ui component's own peer. Explicitly not added: recharts, fullcalendar, dnd-kit, d3-geo,
topojson, simple-icons, shiki, embla, react-day-picker, react-resizable-panels, temporal-polyfill, date-fns, input-otp,
and the template's dev tooling (Biome, husky, lint-staged, ts-node). The builder prunes any dependency not imported by
the final code.

### Testing and verification

- Update `apps/web/e2e/run.mjs` journeys to the new routes and shell: sign-up, sign-in, create prompt, list, packs,
  password change, sign-out, mobile redirect by user agent.
- `pnpm -C apps/web typecheck`, `make verify`, Prettier clean.
- Manual visual check in light and dark on desktop; mobile pages open and function.

## Left to the builder

- Final desktop URL scheme and the matching proxy and `isMobileSplitRoute` changes.
- Which template `ui` components to keep: all of them, or only those used. Default: keep all template `ui` files so
  future screens need no CLI add; drop only demo-specific components (calendar, chart wrappers) tied to excluded libraries.
- Exact primary colour values for the preset, derived from the current `--primary` (`oklch(0.55 0.2 262)`).
- Sidebar entries beyond the four listed, and whether the template's layout controls and support card are kept.

## Builder-check notes (self-review)

- Settled by me, not the owner: keep pnpm, Prettier and Turborepo; no Biome or husky; credit file for MIT; keep all
  template `ui` files by default.
- Risk: the template's `AGENTS.md` says not to edit `components/ui`. Follow it: customise at use sites or via the preset.
- Risk: `apps/web/AGENTS.md` and the Next 16 notice require reading `node_modules/next/dist/docs/` before Next code.
- Risk: replacing `components/ui` touches mobile imports; verify with typecheck and the mobile e2e journey first.
- Suggested slicing for the plan (one PR each): 1) foundation and theme preset with a placeholder dashboard,
  2) auth pages, 3) prompts and packs screens, 4) account, route cleanup and proxy, 5) removal of old shell and unused
  dependencies.
