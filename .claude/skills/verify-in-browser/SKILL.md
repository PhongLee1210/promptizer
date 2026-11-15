---
name: verify-in-browser
description: Verify changes on supported ChatGPT or Claude pages and collect concise visual evidence.
metadata:
  version: '2.0.0'
---

# Verify the extension in the live browser

Unit fixtures prove the fixture, not today's host DOM. Run the whole loop yourself: build, load, drive the page, capture, show. The person only steps in for what no tool can do (signing in, 2FA, a CAPTCHA); say which one and why.

Copy this checklist and tick it off:

```
- [ ] Build loaded: the tab shows a marker or behavior from this change
- [ ] Workflow driven on each changed site
- [ ] Crops saved: changed element, light and dark when CSS changed
- [ ] Evidence shown: paths, or one published page when several crops
- [ ] Test residue listed; own tabs closed
```

## 1. Load the build

Pick the build by what the check proves:

- **Development build**: run `pnpm exec wxt build` and load `.output/chrome-mv3/` from `chrome://extensions`.
- **Production-like build**: use the repository's documented build command when checking packaged output, then reload it from `chrome://extensions`.

Only the main agent loads or reloads extensions, and every extension keeps its load path; a delegated agent asks the main agent instead. When the Claude in Chrome tools report no connected browser, ask the person to run `/chrome` and choose Reconnect, then to quit and reopen Chrome if that fails. When the session has neither browser's tools loaded but chrome-devtools-mcp is configured (`claude mcp list`), drive it from Bash through [scripts/devtools-session.mjs](scripts/devtools-session.mjs): one connection for the whole check, since Chrome asks the person to allow each new one.

Open your own tab, or refresh the reported one once it has no unsent draft or running response, then confirm a marker from this change before collecting evidence: an extension reload alone leaves old content scripts running in open tabs. When someone reported an old build, check their tab too. A refresh to test is not normal navigation; `AGENTS.md` keeps those rules.

## 2. Drive the page

Read the real DOM and computed styles, and compare them with the assumption under test; record the first mismatch with enough surrounding DOM to explain it. Before reasoning about a host's markup, read the site's section of [references/host-shapes.md](references/host-shapes.md).

- **Coordinates**: clicks use the frame the screenshot result reports. Compute targets in JavaScript as CSS px divided by `innerWidth / frameWidth`, then click the result.
- **Typing**: type only after a JavaScript check shows `document.activeElement` is the intended editor. Enter goes only to that editor.
- **Settings**: use the extension UI or available Chrome storage tools. Read values first and restore them after the check.
- **Background tabs**: a tab opened by a tool can stay `visibilityState: 'hidden'`, where `requestAnimationFrame` never fires, so focus or layout done in a frame callback looks broken there. Check `document.visibilityState` before calling it a bug.
- **Themes**: to capture the other theme, flip the host's own theme marker on the page (the attribute or class its `site.json` theme descriptor reads), capture, and flip it back; the person's site setting stays as it was.
- **Probes**: a temporary element can test a CSS rule when the rule is new in this change; remove it afterward.
- **Test data**: use clearly synthetic text such as `Extension test prompt`; keep host conversations untouched.

## 3. Show the evidence

Capture the changed element with `zoom` and `save_to_disk`, cropped to the part a reviewer needs, in light and dark when CSS changed. Keep conversation content out of shared captures when it is private.

One crop: report its path. Several crops or sites: put them in one page with a caption per crop and publish it as an Artifact (or an HTML file when Artifacts are unavailable), and give the link. A page from earlier in the session gets republished to the same link.
