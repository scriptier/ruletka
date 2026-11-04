---
title: Browser live themes hop — tokens must reach icons + buttons
date: 2026-08-16
slug: browser-theme-hop
source_type: code-review
captured_by: grok-ux-critic
skill: spec
binary_inlined: false
---

# Raw: one hop so existing themes recolor rails, SVG icons, pills

## HOP

Retarget the two late `!important` rail color locks to `--tile-chrome-*` / `--tile-accent` and finish those tokens on light + pixel so sprite `currentColor` and accent buttons follow the picker.

## OWN

- `ui/live-themes.css` — add missing token aliases only (do not invent themes)
- `ui/live-stage.css` — partner-rail polish cluster (~18339) + optional `.pill` / `.age-gate-btn` accent wires already half-done (~5689, ~10734)
- `ui/live.html` — **only** the critical/late `.side-btn` color `!important`s (~155–179) and bump `live-themes.css?v=` if tokens change; keep layout pin (flex/width/z-index)

Avoid `live.js` unless the cache-bust string for `live-themes.css?v=2` lives next to the existing theme-loader (~485).

## MUST_NOT

- New themes or new sprite glyphs
- Restyle the whole stage / docks / sheets / tiles
- Touch `ui/live.js` logic, `ui/webrtc.js`, MediaSession, Android, APK, deploy
- Change chrome-autohide / rail visibility / layout pin (only color/border/background)
- `iceCandidatePoolSize` / CONNECTIVITY_LOCK / hunt remount
- Claim product.ok / GOAL_MET from CSS

## WHY

- SVG sprite is already `stroke="currentColor"` and `.icon { color: currentColor }` (`ui/live.html` ~509+, `ui/live-stage.css` ~12–18). Icons inherit `button.color`. They stay night-chrome because two later slabs force `color: #f2f6ff !important` and slate fills: `ui/live.html` `#live-critical` ~155–179 and `ui/live-stage.css` `.tile-remote .side-rail-left .side-btn` ~18339–18386.
- A token language already exists (`:root` `--tile-chrome-*` / `--tile-accent` at `live-stage.css` ~9169; `.side-btn` at ~9614 already consumes it; `.side-btn.active` / `.age-gate-btn.primary` ~10384 / ~10739 already mix `--tile-accent`). Theme files paint `.side-btn` (light ~283, saloon ~776, pink ~1586, pixel ~2828) **without winning the cascade** except pixel’s own `!important`.
- Token holes: light sets chrome text/bg (~2214) but **no `--tile-accent`**; pixel has `--px-*` (~2590) but **does not alias** `--tile-chrome-*` / `--tile-accent`; matrix tokens already live in always-on `live-stage.css` (~9761). Completing aliases + retargeting the two slabs is enough — do not rewrite per-theme button paint.

## Evidence (read 2026-08-16)

### What themes already do

| Theme | Tokens | `.side-btn` paint | Reaches rail? |
|-------|--------|-------------------|---------------|
| dark (default) | `:root` coral `#ff2d55` | base | yes (that is the lock) |
| light | `--tile-chrome-*` only | yes, no `!important` | **no** — html + partner `!important` win |
| pink | `--tile-accent: #ec4899` + chrome | yes, no `!important` | **no** |
| saloon | `--tile-accent: #c45c26` + gold chrome | yes, no `!important` | **no** |
| matrix | tokens in `live-stage.css` ~9761 | `live-stage.css` ~8530 | **partial** — partner rail `!important` still slate |
| pixel | `--px-*` only | `!important` ~2828 | **partial** — same specificity as `.tile-remote .side-rail-left .side-btn`; order-dependent |

`live-themes.css` is deferred (`live.html` ~485, `?v=2`) **after** `live-stage.css?v=461`. Non-`!important` theme rules lose to earlier `!important`.

`ui/live-brand.css` is wordmark/spin only — not in OWN.

### Smallest edit map

1. **`ui/live.html` ~155–179** — keep display/flex/size/z-index `!important`. Change only:
   - `background` → `var(--tile-chrome-bg-strong)`
   - `border-color` → `var(--tile-chrome-border)`
   - `color` → `var(--tile-chrome-text)`
   - `.lbl` color → `var(--tile-chrome-muted)`
2. **`ui/live-stage.css` ~18339–18386** — same token swap on the partner-rail slab; leave sizes/radius. Ensure `.side-btn .ico .icon` does not set a hex color (inherit / currentColor).
3. **`ui/live-themes.css` tokens only**
   - `html[data-theme="light"]`: `--tile-accent` / `--tile-accent-2` (rose already used on light `.brand .badge` / `.side-btn.active`, e.g. `#ff2d55` / `#be123c` — do not invent a new palette)
   - `html[data-theme="pixel"]`: alias `--tile-chrome-bg` → `--px-panel`, `--tile-chrome-bg-strong` → `--px-panel-2`, `--tile-chrome-border` → `--px-border`, `--tile-chrome-text` → `--px-text`, `--tile-chrome-muted` → `--px-muted`, `--tile-accent` → `--px-mag`, `--tile-accent-2` → `--px-cyan`
   - Do **not** duplicate matrix (already in stage) or rewrite pink/saloon chrome blocks
4. **Pills / age-gate (same hop, no new clusters)** — `.pill.primary` / `.pill.accent` (~5689 / ~7779) still hex coral/blue; point **only** those two backgrounds/borders at `var(--tile-accent)` / `var(--tile-accent-2)`. `.age-gate-btn.primary` already tokenized (~10739). Ghost stay as-is unless contrast breaks on light (then `color-mix` on existing `--tile-chrome-text`, not a new component).

### Done when (browser, no APK)

- Settings → Light / Pink / Saloon / Matrix / Pixel: mute / blur / mic SVG and `.lbl` pick up theme ink (not `#f2f6ff` on a slate disc).
- Dark unchanged (tokens already coral/slate).
- `.pill.primary` / `.pill.accent` / age-gate Yes pick `--tile-accent` (pixel magenta, matrix green, saloon leather, pink rose).
- Chrome-autohide and rail hit targets unchanged.
- No MediaSession / webrtc / Android diff.

## Context pins (do not invent)

Session card: live.js 686 · webrtc 335 · live-stage 461 · APK disk 0.1.417+ (unrelated). This hop is browser CSS only.
