# Grammarly "Origin" Design System — extracted scheme

**Source:** Grammarly extension `14.1349.0` (ID `kbfnbcaeplbcioakkpcpgfkobkghlhen`), file `src/css/designSystem.styles.css` (266,110 bytes, sha256 in JSON `$meta`). Static REA extraction — the extension was never executed.

## Files

| File | Contents |
|---|---|
| `grammarly-origin-design-tokens.json` | All tokens, structured by theme → mode (metadata + evidence offsets inside) |
| `origin-tokens.css` | Same tokens as ready-to-use CSS custom properties (verbatim values) |

## Architecture

```
data-origin-theme = grammarly | superhuman     ← brand (Grammarly classic vs "Go"/Superhuman AI)
data-origin-mode  = light | dark               ← color mode (mirrored to data-gds-theme)
                 ┌─ base block  :where(:root,:host),[data-origin-theme=X]      → typography, spacing, radius, z-index, blur (mode-independent)
   designSystem ─┤─ dark block  [data-origin-theme=X][data-origin-mode=dark]   → 359–388 semantic color tokens
                 └─ light block [data-origin-theme=X][data-origin-mode=light]  → 359–388 semantic color tokens
```

**Mode switching (runtime):** `matchMedia('(prefers-color-scheme: dark)')` detected in content script (`Grammarly.js:202,407`, fn `Wi`) → `theme:detected` message to background → React effect sets `data-origin-mode`/`data-origin-theme`/`data-gds-theme` on the injected fixed-position container (`Grammarly.js:341,067`, provider `Grammarly.js:2,374,871`). The GButton popup container defaults to `data-origin-mode="light"` unless overridden (`Grammarly.js:713,071`). Unscoped `:root` default resolves to **light** (light block follows dark in the cascade).

## Core palette — theme `grammarly`

| Token | Light | Dark |
|---|---|---|
| background-base-default | `#fff` | `#2e2e2e` |
| background-base-subdued | `#f5f5f5` | `#1c1c1c` |
| text-base-default | `#1c1c1c` | `#fff` |
| text-base-subdued | `#707070` | `#bcbcbc` |
| border-base-subdued | `#d9d9d9` | `#545454` |
| brand / button-primary fill | `#027e6f` | `#2cc9b6` |
| button-primary hover | `#016a5e` | `#73e1d4` |
| critical | `#cd0800` | `#ff7a74` |
| success | `#027e6f` | `#2cc9b6` |
| warning | `#bd5200` | `#ffbf47` |

## Core palette — theme `superhuman` (Grammarly "Go")

| Token | Light | Dark |
|---|---|---|
| background-base-default | `#fff` | `#292827` |
| background-base-subdued | `#fcfaf7` | `#1f1e1d` |
| text-base-default | `#141413` | `#fff` |
| border-base-subdued | `#dedbd5` | `#474543` |
| brand / button-primary fill | `#714cb6` | `#bea1f5` |
| button-primary hover | `#533192` | `#d4c7ff` |
| critical | `#cd0037` | `#ff565e` |
| success | `#148072` | `#3ac7a1` |
| warning | `#bd5200` | `#ffbf47` |

## Scales (mode-independent, both themes)

- **Fonts:** heading = `"Matter","Inter","-apple-system","Segoe UI","sans-serif"`; body = `"Inter",...`
- **Type ramp:** text 12/14/16/18px (lh 18/21/24/27), headings 14→28px (600 wt), `--origin-rem:16`
- **Spacing:** 4px base — 0,1,2,3,4,5,6,8,10,12,14,16,18,20,24,32,36,40 (+ halves/quarters)
- **Radius:** 0,2,4,6,8,10,12,16,20,24,32,40,48,100px; buttons 4/6/8px
- **Control sizes:** 24/32/40/48/52px; **Z-index:** -100…99999; **Blur:** 0–24px
- **Semantic token families:** background(60), border(222), button(255), text(123), icon(114), logo(80), fill(177), tag(36), illustration(32)

## Legacy chip (GButton) palette — module 15395, `Grammarly.js:843,075` region

White `#ffffff` · teal `#15a694` · error red `#eb0a00` · blue `#2551da` · purple `#5e47e5` · premium orange `#ffa10a` · premium gold `#ffdc85` · premium text `#7a3500` · hover `#f5f5f5` · offline `#707070`
(The chip predates Origin tokens and hardcodes these; the modern Origin palette above governs popups/sidepanel/assistant UI.)
