# PromptWallet — Clean-Room Clone Specification

Target: `https://app.promptwallet.app/` (studied 2026-11-24, black box, authenticated user session).
Method: REA (Chrome DevTools Protocol page inspection, controlled browser scenarios with network capture, static
analysis of the public JS bundle and its public source map). No code, markup, copy text or images from the target
are to be reused; this document describes behavior only. Implementers should write their own UI copy, styling and
code from these requirements.

## 0. How to read this document

Each requirement has an ID (`R-…`) and an **Evidence** line. Status tags:

- **OBSERVED**: seen in a captured request/response, DOM, or an exercised flow.
- **STATIC**: read from shipped client code or server-rendered markup, but the behavior was not exercised.
- **INFERRED**: a conclusion drawn from observations; the reasoning is given.
- **UNKNOWN**: not confirmed. Do not treat as a requirement until verified.

### Evidence index

| Key | REA Evidence ID / source                                                                     | What it holds                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | `ev_247daa9629b77d74a135298d8d23da2b6cc72a071f64b81c7233eb9654adc762` (inspect_web_page)     | Sign-in page: DOM, accessibility tree, scripts, storage keys                                                                                                                                                                        |
| E2  | `ev_b5bfe53a1a93abf08d61d998f3a5d69e941da74c24b2b0c04b0412df3e538154` (analyze_web_bundle)   | Static endpoint candidates in the JS bundle                                                                                                                                                                                         |
| E3  | `ev_4ecb0b91d20a0cc7974114a5ffc0756a1d6925fceda2ba96dc2d820713ee7f4e` (inspect_web_page)     | Prompt detail page, storage key inventory                                                                                                                                                                                           |
| E4  | `ev_bacc7ee81b5dfa0a5c90a6b57d97d96a8775d93aa71e425a673b22af159c3ff6` (scenario)             | Home page DOM + network                                                                                                                                                                                                             |
| E5  | `ev_c47a31306330…` (scenario, steps 1–14)                                                    | Read-only crawl: list, filtered list, detail, create, categories, tags, libraries, library, prompt packs, library create, workspace settings, profile, support, 404                                                                 |
| E6  | `ev_6293d36b93e8…` (scenario, steps 1–17)                                                    | Read-only crawl: version history, six inline-edit fragments, category/tag create+edit, library edit, pack view, change email, change password, empty search, page 2                                                                 |
| E7  | `ev_1963f0cf21dcd76a5d71c16d98e4e0513dda5e1f6722bd4a9d7275317aefcbc3` (scenario)             | **Exercised**: create prompt with AI metadata                                                                                                                                                                                       |
| E8  | `ev_ce66fa27eebe06e9a6722556207f030e08cff4be7f2b4e71aa9ed246e9036de2` (scenario)             | **Exercised**: auto-save                                                                                                                                                                                                            |
| E9  | `ev_079c6233c6ee0ff51e080f86e3ed3e8468396f44c079dddd9ab4e3fd861a1745` (scenario)             | **Exercised**: release version, inline title edit, example-usage edit, public share, version history (2 versions), duplicate                                                                                                        |
| E10 | `ev_b4a3ede48a0569d6a0f00df69847d7a3971d768c0b9573a2685857e8f3a7ffae` (scenario)             | **Exercised**: delete prompt (×2), 404 after delete, tags list                                                                                                                                                                      |
| E11 | `ev_a674dda56d7f11e9ddbc51ff5d7159bde856f315baa48f2cff9fe1b0ef30e575` (scenario)             | **Exercised**: delete tag                                                                                                                                                                                                           |
| S1  | Public bundle `/static/webpack_bundles/js/app-3848462d7e9c1a549954.js` + `.js.map`             | First-party modules: `static/js/app.js`, `components/editor/editor_component_remark.js`, `…/markdown_renderer.js`, `…/example_editor.js`, `…/viewer_component_remark.js`, `components/combobox.js`, `multiselect.js`, `multiselect_add.js` |
| C1  | Unauthenticated `curl` probes                                                                | `/` → 302, public share page 200, bad share slug 404, share after prompt delete 404                                                                                                                                                 |

The full Evidence bundle (all records above) was exported to the session scratchpad as `bundle7.json`. It contains
the account holder's personal data and CSRF tokens. Keep it private and out of version control.

## 1. Architecture (as observed)

| ID     | Requirement                                                                                                                                                                                                                                                                                                                                       | Status   | Evidence                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------- |
| R-A1   | Server-rendered multi-page app. Every screen is a full HTML document from the server. Cookie session auth.                                                                                                                                                                                                                                        | OBSERVED | C1 (`/` → `302 /accounts/login/?next=/`, `vary: Cookie`); E5 every step is a `document` response                 |
| R-A2   | Partial page updates use an "AJAX fragment swap" pattern: a link or form marked with a target element id issues a request, and the server returns an HTML fragment whose root has that same id, which replaces the target. Requests carry headers identifying them as fragment requests (`X-Alpine-Request`, `X-Alpine-Target`). | OBSERVED | E9 steps 4, 6, 8, 10 (request header names; response root `<div id="prompt-title-content-{id}">`)                 |
| R-A3   | Client interactivity uses a small reactive-attribute library (Alpine.js observed) plus focus-trap helpers. No SPA router.                                                                                                                                                                                                                          | STATIC   | S1 `static/js/app.js` registers Alpine, an AJAX plugin, a focus plugin and 6 components                         |
| R-A4   | JSON endpoints under `/api/…` and `…/share/` are called with `fetch`. CSRF token comes from `<meta name="csrf-token">` or a hidden `csrfmiddlewaretoken` input and is sent as the `X-CSRFToken` header.                                                                                                                                           | OBSERVED | E8/E9 request header names include `x-csrftoken`; S1 `editor_component_remark.js`                                |
| R-A5   | Classic form posts use `application/x-www-form-urlencoded` (or `multipart/form-data` for uploads) with a `csrfmiddlewaretoken` field, and redirect with 302 on success (POST-redirect-GET).                                                                                                                                                       | OBSERVED | E10 step 2/5 (`POST …/delete/` → 302); E7 step 4 (`create-with-metadata` → 302)                                   |
| R-A6   | Pages carry `noindex, nofollow`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, HSTS, `Cross-Origin-Opener-Policy: same-origin`.                                                                                                                                                                    | OBSERVED | C1 response headers; public share page meta robots (C1)                                                         |
| R-A7   | Third-party product analytics (PostHog: autocapture, pageview, identify by user id) and Cloudflare RUM beacons. Optional for a clone.                                                                                                                                                                                                             | OBSERVED | E4 network by-origin; inline init script in E5 step 0                                                            |
| R-A8   | Background job + polling pattern for AI metadata generation (task id returned, client polls a status endpoint).                                                                                                                                                                                                                                  | OBSERVED | E7                                                                                                               |

## 2. Domain model (inferred from UI and payloads)

| Entity           | Fields observed                                                                                                                                                                                                                                                         | Evidence                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| User             | id (int), email, first_name, last_name, display name (`name`, required), date_joined, staff/superuser/demo flags                                                                                                                                                         | E6 profile form; E5 analytics identify call (field names only) |
| Workspace        | name, slug (e.g. `…-workspace`), setting `auto_generate_metadata` (bool). User has a current workspace and can create more.                                                                                                                                            | E5 step 11, sidebar workspace form                          |
| Prompt           | id (int), title, text (Markdown), category (0..1), tags (0..n), model (enum, 0..1), example_usage (Markdown, optional), example_output (type `text`\|`image`, text or image file), versions (1..n), share link (0..1 per version, INFERRED)                                | E5 step 3; E6 steps 2–7; E9                                 |
| PromptVersion    | id (int, distinct from version number), version_number (1-based), text snapshot, created_at                                                                                                                                                                             | E9 step 15 (`?compare_version=<version id>`)                |
| Category         | id, name (≤100 chars, required). Prompt usage count.                                                                                                                                                                                                                    | E6 steps 8–9; E5 step 5                                     |
| Tag              | id, name (≤100 chars, required, **case-sensitive**: `IT` and `it` coexist). Prompt usage count.                                                                                                                                                                         | E6 steps 10–11; E5 step 6                                   |
| Library          | id, name (≤200, required), description (optional), many-to-many prompts. Prompt count.                                                                                                                                                                                  | E5 step 10; E6 step 12                                      |
| Prompt Pack      | system-provided starter library (id, name, description, prompt list). Cloning creates a user Library, tracked by pack name.                                                                                                                                             | E5 step 9; E6 step 13                                       |
| Share            | slug (16 hex chars), url, version_number, target (prompt / category / library)                                                                                                                                                                                          | E9 step 13; E5 steps 5, 7 inline scripts                    |
| Model enum       | `chatgpt`, `claude`, `gemini`, `grok`, `deepseek`, `llama`, `mistral`, `midjourney`, `sora`, `flux`, `veo` (plus empty = none). Display labels are the vendor names.                                                                                                    | E6 step 4 (`inline-update-model` fragment option list)      |

## 3. Screens and routes

All routes require authentication unless marked **public**. An unauthenticated request to a protected route
redirects to `/accounts/login/?next=<path>` (OBSERVED for `/`, C1).

| Route                                         | Screen                         | Status   | Evidence     |
| --------------------------------------------- | ------------------------------ | -------- | ------------ |
| `/accounts/login/` **public**                 | Sign in                        | OBSERVED | E1           |
| `/accounts/signup/` **public**                | Sign up                        | UNKNOWN (link seen, page not captured) | E1 |
| `/accounts/password/reset/` **public**        | Forgot password                | UNKNOWN (link seen)  | E6 step 15 |
| `/accounts/logout/`                           | Sign out                       | UNKNOWN (link seen, not exercised) | E5 |
| `/` and `/prompts/~list/`                     | Prompt list (My Prompts)       | OBSERVED | E4, E5 step 1 |
| `/prompts/create/`                            | New prompt                     | OBSERVED | E5 step 4, E7 |
| `/prompts/{id}/`                              | Prompt editor/detail           | OBSERVED | E5 step 3    |
| `/prompts/{id}/versions/[?compare_version={versionId}]` | Version history + compare | OBSERVED | E6 step 1, E9 step 15 |
| `/prompts/{id}/duplicate/`                    | Duplicate (action via **GET**) | OBSERVED | E9 step 16   |
| `/prompts/{id}/delete/`                       | Delete confirmation            | OBSERVED | E10          |
| `/prompts/categories/` (+ `create/`, `{id}/edit/`, `{id}/delete/`) | Manage categories | OBSERVED (list, create, edit forms); delete page UNKNOWN | E5 step 5, E6 steps 8–9 |
| `/prompts/tags/` (+ `create/`, `{id}/edit/`, `{id}/delete/`) | Manage tags           | OBSERVED | E5 step 6, E6 steps 10–11, E11 |
| `/prompts/libraries/` (+ `create/`, `{id}/`, `{id}/edit/`, `{id}/delete/`) | Libraries | OBSERVED (list, view, create, edit); delete UNKNOWN | E5 steps 7, 8, 10; E6 step 12 |
| `/prompts/libraries/starter-templates/` and `…/{packId}/` | Prompt Packs, pack detail | OBSERVED | E5 step 9, E6 step 13 |
| `/prompts/shared/{slug}/` **public**          | Public shared prompt           | OBSERVED | C1           |
| `/workspaces/{slug}/settings/`                | Workspace settings             | OBSERVED | E5 step 11   |
| `/workspaces/start-team-trial/`               | Team trial upsell              | UNKNOWN (deliberately not opened; may start a trial on GET) | E5 sidebar |
| `/users/my_profile/`                          | Profile                        | OBSERVED | E5 step 12   |
| `/accounts/email/`                            | Change email                   | OBSERVED (form only) | E6 step 14 |
| `/accounts/password/change/`                  | Change password                | OBSERVED (form only) | E6 step 15 |
| `/support/`                                   | Feedback                       | OBSERVED (form only) | E5 step 13 |
| any unknown path or foreign/deleted id        | 404 page with "back home" links | OBSERVED | E5 step 14 (`/prompts/1/`), E10 step 7 |

### 3.1 App shell (every authenticated page)

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-S1  | Top bar: logo → `/`, global search box (GET `/prompts/~list/?q=`), user menu (Profile, Workspace Settings, Sign Out). Mobile: sidebar toggle button. | OBSERVED | E5 step 1 |
| R-S2  | Sidebar: workspace switcher dropdown with an inline "create workspace" text field (POST `/workspaces/create/`, field `name`); quick actions New Prompt and New Library; links All Prompts, Prompt Packs; collapsible **Libraries** section listing each library with its prompt count; collapsible **Categories** section showing the first N categories with a "Show 10 more" expander; Manage Tags; Feedback. | OBSERVED (rendered); workspace create POST UNKNOWN | E5 step 1 |
| R-S3  | Sidebar section collapsed/expanded state persists per browser in `localStorage` keys `sidebar-libraries-collapsed`, `sidebar-libraries-expanded`, `sidebar-categories-collapsed`, `sidebar-categories-expanded` (string `"true"`/`"false"`). | STATIC | E5 inline `x-data` |
| R-S4  | Team-trial promo card is dismissible; dismissal stores `team-promo-dismissed-until` = now + 3 days (epoch ms) in `localStorage` and hides the card until then. | STATIC | E5 inline `x-data` |
| R-S5  | Dark mode: `localStorage['dark'] === 'true'` adds class `dark` on `<html>` before first paint (avoid flash). Toggle control location UNKNOWN. | STATIC | E5 head inline script; `<html x-data>` |
| R-S6  | Footer with copyright and contact links. | OBSERVED | E1 |

### 3.2 Sign in (public)

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-L1  | Fields: Email (textbox, required), Password, "Remember Me" checkbox; Sign In button; links "Forgot your password?" and "Sign up". Successful login redirects to `next`. | OBSERVED (form) / INFERRED (`next` redirect, from the `?next=` param) | E1 accessibility tree; C1 |
| R-L2  | Social login, email verification, lockout and error messages are UNKNOWN. | UNKNOWN | — |

### 3.3 Prompt list

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-P1  | Heading "My Prompts" with total count. | OBSERVED | E5 step 1 (`64`) |
| R-P2  | Cards: title, rendered Markdown preview of the text (truncated visually), model badge/icon; card links to `/prompts/{id}/`. | OBSERVED | E5 step 1 |
| R-P3  | Filters via query string: `q` (text search), `tags` (tag id(s)), `categories` (category id), `libraries` (library id), `page`. A multi-select tag dropdown with its own search box auto-submits on change. Active filters show "Clear" links. | OBSERVED (params in links); multi-value encoding UNKNOWN | E5 steps 1–2; E6 steps 16–17; S1 `multiselect.js` |
| R-P4  | Pagination: 10 prompts per page; numbered links `?page=N`, previous/next; out-of-range page behavior UNKNOWN. | INFERRED (10 cards on page 1, 7 pages for 64 prompts) | E5 step 1; E6 step 17 |
| R-P5  | Empty search result: message "no prompts found" + hint + "Clear All Filters" → `/prompts/~list/`. | OBSERVED | E6 step 16 |
| R-P6  | Search fields (title only vs. text) and sort order are UNKNOWN. Default order appears to be most recently created/updated first. | UNKNOWN / INFERRED | E5 step 1 (newest test prompt id appeared at the top, E10 step 3) |

### 3.4 Create prompt (AI metadata flow)

State machine (OBSERVED, E7; client code STATIC in E5 step 4 inline script):

```
Editing ──(Save, text non-empty)──► Submitting
Submitting ──POST /prompts/create/ ok──► Polling(task_id)        [progress modal opens]
Submitting ──error──► Editing                                     [blocking alert, button re-enabled]
Polling ──status=pending──► Polling (wait 1.5 s)
Polling ──status=progress──► Polling (wait 1.5 s)                 [show current step + partial title/tags/category]
Polling ──status=success──► Complete
Polling ──HTTP error | network error | unknown status──► Failed   [stop polling, show network error]
Complete ──wait 2 s (or 5 s if errors[] non-empty)──► Persisting
Persisting ──hidden form POST /prompts/create-with-metadata/──► 302 → /prompts/{newId}/
```

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-C1  | Editor: one required textarea `text`, a Markdown preview toggle, and a slide-over "Prompting Cheatsheet" drawer (Markdown and XML-tag guidance). Save is disabled while `text` is empty. | OBSERVED | E5 step 4 |
| R-C2  | `POST /prompts/create/` as `multipart/form-data` {`csrfmiddlewaretoken`, `text`} with `X-Requested-With: XMLHttpRequest` → `200 {"task_id": "<uuid>"}`. | OBSERVED | E7 step 2 |
| R-C3  | `GET /api/prompt-metadata-status/?task_id=<uuid>` → `{status, …}`. Progress shape: `{"status":"progress","step":"title","step_number":1,"total_steps":3,"message":…,"completed_steps":[],"title":"","tag_names":[],"category_name":""}`. Success shape: `{"status":"success","title":…,"tag_names":[…],"category_name":…,"errors":[]}`. A `pending` status also exists. Steps are `title`, `tags`, `category`. | OBSERVED (progress, success); STATIC (pending) | E7 step 3 |
| R-C4  | `POST /prompts/create-with-metadata/` (urlencoded) {`csrfmiddlewaretoken`, `text`, `title`, `tag_names` (JSON array string), `category_name`} → `302 /prompts/{id}/`. Unknown tag names are **auto-created**. Category is matched by name (creation for unknown names UNKNOWN). | OBSERVED (a new tag `data-analysis` with 0 other uses appeared) | E7 step 4; E10 step 8 |
| R-C5  | The AI generator chooses tags/category from or beyond the user's existing vocabulary. Model/provider behind it is UNKNOWN. What happens when the workspace setting "AI metadata generation" is off is UNKNOWN (presumably skip polling and use defaults). | UNKNOWN | E5 step 11 |
| R-C6  | Alternative JSON create endpoint `POST /api/prompts/create/` {title, text, category, model_name, tags[]} → `{prompt_id}`; on failure `{error|detail, code}`, with `403 + code:"tier_limit"` meaning plan limit reached. If title is empty, the client asks for confirmation and saves as "Untitled Prompt". No screen was observed using it. | STATIC only | S1 `editor_component_remark.js` `createPrompt`; E2 |

### 3.5 Prompt editor/detail `/prompts/{id}/`

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-D1  | Breadcrumb; toolbar buttons Copy, Share, More ▾ {Release New Version, Version History, Duplicate Prompt, Delete Prompt}. | OBSERVED | E5 step 3 |
| R-D2  | Copy writes the current editor text to the clipboard (Clipboard API, falling back to a hidden textarea + `execCommand('copy')`) and shows a "copied" state for 2 s. | STATIC | S1 `app.js` `$clipboard` magic; E5 step 3 button handler |
| R-D3  | Metadata header with four independently inline-editable fields: title, category, model, tags. Only one field can be in edit mode at a time; the others are dimmed and non-interactive while one is open. Clicking outside an open editor cancels it. | OBSERVED (title edited); STATIC (exclusivity, outside-click cancel) | E9 steps 4–7; E6 steps 2–5 fragments |
| R-D4  | Inline edit protocol per field: `GET <editUrl>` returns an edit-form fragment, `POST <editUrl>` saves and returns the display fragment, `GET <cancelUrl>` returns the display fragment unchanged. URLs: title `/prompts/inline/{id}/title/edit|cancel/` (field `title`, required); category `/prompts/inline/{id}/category/edit/` (`category` = id or empty, **or** `new_category_name` to create-and-assign); model `/prompts/prompts/{id}/inline-update-model/` + `…-cancel/` (combobox, form field `make`); tags `/prompts/inline/{id}/tags/edit|cancel/` (hidden `tags`; type-ahead adds existing tags or creates new ones on Enter). | OBSERVED (title GET+POST); STATIC (others: forms captured, not submitted) | E9 steps 4, 6; E6 steps 2–5 |
| R-D5  | Body editor: split Markdown source textarea and live rendered preview with a "Markdown Preview" toggle, a live character count (counts raw Markdown characters), a version label (`vN - latest`) and save state ("Saving…" / "Auto-saved"). | OBSERVED | E5 step 3; E9 |
| R-D6  | **Auto-save**: each input event re-renders the preview and schedules a debounced save **5000 ms** after the last keystroke. `POST /api/auto-save/` JSON `{"promptId":"<id>","text":"<full text>"}` → `200 {"text":…,"message":"Auto-saved successfully","has_unsaved_changes":""}`. Empty text is sent as `""`. Client errors are logged only (no user-facing error). | OBSERVED (request/response); STATIC (debounce, error handling) | E8 step 2; S1 `editor_component_remark.js` |
| R-D7  | **Auto-save overwrites the latest version's text in place**. It does not create a version. | OBSERVED: after auto-save then release, v1 and v2 both held the auto-saved text | E9 step 15 |
| R-D8  | **Release New Version**: `POST /api/release-version/` JSON `{"promptId","text"}` → `201 {"message":…,"version_number":N+1}`. The client updates the version label; button shows a busy state. On non-OK the client only logs. | OBSERVED | E9 step 2; S1 |
| R-D9  | "Example usage" section: empty state is an add link; edit fragment has one Markdown textarea `example_usage` with a Preview/Edit toggle; `POST /prompts/inline/{id}/example-usage/edit/` (urlencoded) returns the display fragment with rendered Markdown. | OBSERVED | E9 steps 8, 10 |
| R-D10 | "Example output" section: radio `example_output_type` ∈ {`text`,`image`}; text mode uses textarea `example_output_text`; image mode uses file input `example_output_image` accepting JPEG/PNG/GIF/WebP, **max 5 MB** (client-side check, error shown and selection cleared), with local blob preview; POST is `multipart/form-data` to `/prompts/inline/{id}/example-output/edit/`. Server-side limits, storage and serving URL are UNKNOWN. | STATIC (form + client validation); POST UNKNOWN | E6 step 7; S1 `example_editor.js` |
| R-D11 | Viewing another user's prompt id, or a deleted one, returns the 404 page. | OBSERVED (`/prompts/1/` and a deleted id → 404) | E5 step 14; E10 step 7 |

### 3.6 Markdown rendering (shared by editor, list cards, viewer, share page)

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-M1  | CommonMark + GFM (tables, task lists, strikethrough, autolinks, footnotes) + math (KaTeX) + Mermaid diagrams + syntax highlighting, rendered client-side, with HTML sanitized. | STATIC | S1 `markdown_renderer.js` plugin chain; package list in source map |
| R-M2  | **XML-style prompt blocks**: any paired tag `<name …>…</name>` whose name is *not* a standard HTML element is pulled out before Markdown parsing, its inner content is rendered recursively as Markdown, and it is displayed as a labeled block showing the literal opening tag above and the closing tag below the rendered body. Standard HTML tag names pass through to the normal (sanitized) pipeline. | STATIC | S1 `markdown_renderer.js` |
| R-M3  | Render failure shows an inline "error rendering" message in the preview instead of throwing. | STATIC | S1 `editor_component_remark.js` `updatePreview` |

### 3.7 Version history `/prompts/{id}/versions/`

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-V1  | Table of all versions (newest first): version label (`vN`, "Latest" badge), created timestamp (e.g. `Nov 24, 2026 9:10 AM`), truncated content preview, action ("Current" for latest, "Compare" link for older ones → `?compare_version={versionId}`). | OBSERVED | E9 step 15 |
| R-V2  | Compare panel: "Latest (vN) vs [select older version]"; two side-by-side cards with a word/line diff (green = additions, red = removals). With one version: an "only one version available" empty state. Diff algorithm (client or server) UNKNOWN. | OBSERVED (UI); UNKNOWN (algorithm) | E6 step 1; E9 step 15 |
| R-V3  | Restore/revert to an old version: not present in the UI. | OBSERVED absence (no such control on the page) | E9 step 15 |

### 3.8 Duplicate and delete

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-X1  | `GET /prompts/{id}/duplicate/` **immediately** creates a copy titled `Copy of <title>` and returns `302 /prompts/{newId}/`. No confirmation. (A clone should use POST; this is a target quirk.) | OBSERVED | E9 step 16 |
| R-X2  | Delete prompt: `GET /prompts/{id}/delete/` shows a confirmation naming the prompt and warning that it cannot be undone, with Cancel (→ prompt) and Delete; `POST` same URL → `302 /prompts/~list/`. Deleting a prompt also invalidates its public share link (share URL → 404). | OBSERVED | E10 steps 0–7; C1 |
| R-X3  | Delete tag: confirmation page shows a "safe to delete" notice when the tag is unused (wording for in-use tags UNKNOWN); `POST` → `302 /prompts/tags/`. | OBSERVED | E11 |
| R-X4  | Delete category / library: same confirm-then-POST pattern expected; effect on prompts (detach vs. cascade) UNKNOWN. | INFERRED / UNKNOWN | E5 links |

### 3.9 Sharing

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-SH1 | Prompt share dialog: explains that the link is public and names the creator; "Create Public Share Link" → `POST /prompts/{id}/share/` JSON `{"version_number": N}` → `200 {"share_url":"https://<host>/prompts/shared/<16-hex slug>/?utm_source=share&utm_medium=referral&utm_campaign=prompt","share_slug":…,"created":true,"version_number":N}`. Then shows the URL with Copy (2 s "copied" state). Error: `{error}` shown inline; network failure shows a generic retry message. | OBSERVED | E9 steps 12–14 |
| R-SH2 | Target quirk: the `version_number` sent is baked into the page at render time, so sharing right after "Release New Version" without a reload shares the previous version number. A clone should send the current version. | OBSERVED (sent `1` after v2 was released) | E9 steps 2, 13 |
| R-SH3 | Whether repeat share calls reuse the slug (`created:false`) is UNKNOWN. Revoke/unshare is not present in the UI. | UNKNOWN | — |
| R-SH4 | Public page `/prompts/shared/{slug}/`: no auth; shows title, "shared by <display name>", rendered prompt, a "Save to Wallet" button, and sign-up/login CTAs (`login?next=` back to the share). Unknown slug → 404. `noindex`. "Save to Wallet" behavior is UNKNOWN. | OBSERVED (page); UNKNOWN (save) | C1 |
| R-SH5 | The share page showed the auto-saved text even though the share was for `version_number:1`. Combined with R-D7, the shared version reflects later auto-saves of that version. | OBSERVED | C1 vs E9 |
| R-SH6 | Category share: confirm dialog → `POST /prompts/categories/{id}/share/` (no body) → `{share_url}`; all prompts in the category become viewable via the link. Library share: `POST /prompts/libraries/{id}/share/` → `{share_url}` / `{error}`. Public page formats for category/library shares are UNKNOWN. | STATIC | E5 steps 5, 7, 8 inline scripts |

### 3.10 Categories, tags, libraries, prompt packs

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-T1  | Manage Categories / Manage Tags: table {name, prompt usage count, Edit, Delete} plus a Create button. Tag usage count links to `/prompts/~list/?tags={id}`. Category rows also have Share. | OBSERVED | E5 steps 5–6 |
| R-T2  | Create/Edit category/tag: one required `name` field (maxlength 100). The edit page also lists the prompts using it. Uniqueness/case rules: tags `IT` and `it` coexist, so names are case-sensitive. Duplicate-name error UNKNOWN. | OBSERVED (forms); INFERRED (case-sensitivity) | E6 steps 8–11; E5 step 6 |
| R-T3  | Library create/edit: `name` (required, maxlength 200), `description` (optional), and a prompt picker: checkbox list `selected_prompts`, client-side filtering by categories and tags (multi-select dropdowns with Clear/Done), and "Select all visible". | OBSERVED (form); POST UNKNOWN | E5 step 10; E6 step 12 |
| R-T4  | Library view: name, description, prompt count, Edit, Share, More ▾ {Delete Library}, prompt cards. | OBSERVED | E5 step 8 |
| R-T5  | Prompt Packs: a grid of system packs; each card has "View prompts in this pack" and either **Add** (`POST /api/starter-templates/{packId}/clone/` → `{library_id}` or `{error}`) or, if already cloned, **Remove** (`DELETE /api/libraries/{libraryId}/delete/` → JSON). Success/error toast for 3 s, then full page reload after 1.5 s. "Already cloned" is decided by matching the **pack name** to a user library name. | STATIC | E5 step 9 inline script |
| R-T6  | Pack detail: name, "curated starter pack with N prompts", "Add pack to my libraries" (form POST to the same URL), about text, full prompt list. | OBSERVED (page); POST UNKNOWN | E6 step 13 |

### 3.11 Settings, profile, support

| ID    | Requirement | Status | Evidence |
| ----- | ----------- | ------ | -------- |
| R-W1  | Workspace Settings: "AI metadata generation" checkbox `enabled`, POST `/workspaces/{slug}/toggle-auto-generate-metadata/`. Response UNKNOWN. | OBSERVED (form) | E5 step 11 |
| R-W2  | Profile: form POST `/users/~update/` {`first_name`, `last_name`, `name` (display name, required)}; links to Change Email and Change Password; read-only account info block. | OBSERVED (form) | E5 step 12 |
| R-W3  | Change email: shows current email; field `email`; POST `/accounts/email/`. Verification flow UNKNOWN. | OBSERVED (form) | E6 step 14 |
| R-W4  | Change password: `oldpassword`, `password1`, `password2` (all required); POST `/accounts/password/change/`; "Forgot Password?" link. Password rules UNKNOWN. | OBSERVED (form) | E6 step 15 |
| R-W5  | Feedback: required textarea `message`; Send/Cancel; POST to the same page. Delivery mechanism UNKNOWN. | OBSERVED (form) | E5 step 13 |
| R-W6  | Plans, billing, team workspaces, members, trial: only the "Start 30-Day Free Trial" entry point is visible; everything behind it is UNKNOWN. A tier/plan limit exists (`tier_limit`, R-C6). | UNKNOWN | E5 sidebar; S1 |

## 4. Network protocol summary

| Method | Path | Body | Success | Errors | Status | Evidence |
| ------ | ---- | ---- | ------- | ------ | ------ | -------- |
| POST | `/prompts/create/` | multipart `text` | `200 {task_id}` | client alert on non-OK | OBSERVED | E7 |
| GET | `/api/prompt-metadata-status/?task_id=` | — | `{status: pending\|progress\|success, …}` | non-OK → stop polling | OBSERVED | E7 |
| POST | `/prompts/create-with-metadata/` | urlencoded `text,title,tag_names(JSON),category_name` | `302 /prompts/{id}/` | UNKNOWN | OBSERVED | E7 |
| POST | `/api/prompts/create/` | JSON `title,text,category,model_name,tags[]` | `{prompt_id}` | `{error\|detail, code}`, `403 tier_limit` | STATIC | S1 |
| POST | `/api/auto-save/` | JSON `promptId,text` | `200 {text,message,has_unsaved_changes}` | UNKNOWN | OBSERVED | E8 |
| POST | `/api/release-version/` | JSON `promptId,text` | `201 {message,version_number}` | UNKNOWN | OBSERVED | E9 |
| GET/POST | `/prompts/inline/{id}/{title\|category\|tags\|example-usage\|example-output}/edit/`, `…/cancel/` | urlencoded / multipart | HTML fragment `id=<target>` | validation fragment UNKNOWN | OBSERVED (title, example-usage) | E9 |
| GET/POST | `/prompts/prompts/{id}/inline-update-model/`, `…-cancel/` | urlencoded `make` | HTML fragment | UNKNOWN | STATIC | E6 |
| POST | `/prompts/{id}/share/` | JSON `version_number` | `{share_url,share_slug,created,version_number}` | `{error}` | OBSERVED | E9 |
| POST | `/prompts/categories/{id}/share/`, `/prompts/libraries/{id}/share/` | none | `{share_url}` | `{error}` | STATIC | E5 |
| POST | `/api/starter-templates/{packId}/clone/` | none | `{library_id}` | `{error}` | STATIC | E5 |
| DELETE | `/api/libraries/{id}/delete/` | none | JSON | `{error}` | STATIC | E5 |
| GET | `/prompts/{id}/duplicate/` | — | `302 /prompts/{newId}/` | — | OBSERVED | E9 |
| POST | `/prompts/{id}/delete/`, `/prompts/tags/{id}/delete/` | urlencoded csrf | `302` to the list | — | OBSERVED | E10, E11 |
| POST | `/workspaces/create/`, `/workspaces/{slug}/toggle-auto-generate-metadata/`, `/users/~update/`, `/accounts/email/`, `/accounts/password/change/`, `/support/`, category/tag/library create+edit | urlencoded | presumably 302 | UNKNOWN | form only | E5, E6 |

No WebSocket, Server-Sent Events, Service Worker, IndexedDB or Cache Storage use was observed (E3 storage inventory:
no IndexedDB databases or caches; E4 network: no websocket transactions).

## 5. Persistence layout

| Where | Keys | Purpose | Evidence |
| ----- | ---- | ------- | -------- |
| Server DB | entities in §2 | all user data | — |
| Cookies | session + CSRF (names not captured; value capture disabled) | auth, CSRF | C1 `vary: Cookie`; UNKNOWN names |
| `localStorage` | `dark`, `sidebar-libraries-collapsed`, `sidebar-libraries-expanded`, `sidebar-categories-collapsed`, `sidebar-categories-expanded`, `team-promo-dismissed-until`, analytics key | per-browser UI prefs | E3, E5 |
| `sessionStorage` | analytics window/session keys; `htmx-current-path-for-history` (a history-library leftover) | analytics / none required | E1, E3 |
| Uploaded files | example-output images | UNKNOWN storage/URL | E6 step 7 |

## 6. File formats

| ID   | Requirement | Status | Evidence |
| ---- | ----------- | ------ | -------- |
| R-F1 | Prompt text, example usage and text example output are plain Markdown strings (CRLF line endings were present in stored text). | OBSERVED | E5 list `remarkViewer` args contain `\u000D\u000A` |
| R-F2 | Image example output: JPEG, PNG, GIF, WebP, ≤5 MB (client check). | STATIC | E6 step 7; S1 |
| R-F3 | Import/export (JSON, CSV, etc.): no UI found. | OBSERVED absence (bounded to the screens in §3) | E5, E6 |

## 7. Error behaviors

| ID   | Behavior | Status | Evidence |
| ---- | -------- | ------ | -------- |
| R-E1 | Unauthenticated access → 302 to login with `next`. | OBSERVED | C1 |
| R-E2 | Missing/foreign/deleted resource → HTML 404 page ("page not found" + Back to Home / Go Back). | OBSERVED | E5 step 14; E10 step 7 |
| R-E3 | Create-task start failure → blocking browser alert, button re-enabled. Polling failure → progress modal shows a network-error state and polling stops. Metadata step errors (`errors[]`) → shown, and the redirect delay grows from 2 s to 5 s. | STATIC | E5 step 4 inline script |
| R-E4 | Auto-save and release-version failures are silent to the user (console only). A clone should surface them. | STATIC | S1 |
| R-E5 | Share failures: server `{error}` shown in the dialog; network failure shows a "try again" message. | STATIC | E5 step 3, 7, 8 |
| R-E6 | Plan limit on create → `403 {code:"tier_limit", error}`, shown as an error message (create-error event). | STATIC | S1 |
| R-E7 | Form validation errors (duplicate names, empty required fields, wrong current password) are UNKNOWN beyond HTML `required`/`maxlength`. | UNKNOWN | — |

## 8. Open questions (UNKNOWN backlog)

1. Sign-up, email verification, password reset, logout, social login.
2. Plans/tiers: limits per tier, what `tier_limit` gates, billing, team trial and team workspaces/members/permissions.
3. Behavior when the "AI metadata generation" setting is off; which AI provider is used; timeouts.
4. List search fields, sort order, and multi-tag filter semantics (AND vs OR).
5. Category/library delete semantics (cascade vs detach); duplicate-name validation.
6. Share link idempotency, revocation, and public category/library share pages; "Save to Wallet" flow.
7. Example-output image storage and serving; server-side size/type validation.
8. Version diff algorithm; whether auto-save ever creates versions on its own (`has_unsaved_changes` was an empty string).
9. Workspace switching semantics (are prompts per workspace?).
10. Rate limiting and concurrency (two tabs auto-saving the same prompt).

## 9. Test side effects (for the record)

The exercised flows ran only on throwaway items, which were removed afterwards: test prompts 2837236 and 2837237,
one auto-created tag (`data-analysis`, id 170983) and one public share slug, which now returns 404. Afterwards the
account had 64 prompts and 14 tags, matching the starting counts (E10, E11, C1).
