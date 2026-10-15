# Second critic — browser live.html themes + icons + buttons

Date: 2026-08-16
Role: Claude-style read-only critic
Ask: agree/disagree hop = make existing `--tile-accent` / `currentColor` actually paint side-rail buttons, pills, SVG icons; no new theme pack; no ICE / live.js connect.

## Verdict

AGREE=yes

The recommended hop is the right one. Six themes already exist (dark / light / saloon / matrix / pink / pixel). Sprites already stroke `currentColor`. `:root` and per-theme blocks already set `--tile-accent` / `--tile-chrome-*`. The live chrome does not use them because later `!important` hardcodes win.

## Evidence

### Tokens already defined

`ui/live-stage.css` `:root` ~9168–9182:

- `--tile-chrome-bg`, `--tile-chrome-bg-strong`, `--tile-chrome-border`
- `--tile-chrome-text`, `--tile-chrome-muted`
- `--tile-accent: #ff2d55`, `--tile-accent-2: #ff5c3a`

Per-theme:

- matrix in `live-stage.css` ~9761–9768 (`--tile-accent: #00a83e`)
- pink / saloon in `live-themes.css` ~2214–2233 (`#ec4899` / `#c45c26`)
- light/pink share chrome tokens; light does **not** override `--tile-accent` (keeps default rose)
- pixel has `--px-*` (`--px-mag`, `--px-cyan`) but does **not** set `--tile-accent`

Mid-file token-driven rules already exist and lose:

- `.side-btn` ~9614–9622 uses `--tile-chrome-*` (no `!important`)
- `.side-btn.active` ~10384–10389 uses `color-mix(... var(--tile-accent) ...)` with `!important`, then later remote-rail block overrides it

### SVGs already currentColor

`ui/live.html` sprite ~509+: every symbol is `fill="none" stroke="currentColor"`.
`ui/live-stage.css` `.icon { color: currentColor }` ~13–18.

Icons will recolor when the parent `.side-btn` `color` is no longer hardcoded.

### Winning hardcodes (this is the hop)

1. **`ui/live.html` inline** ~155–179 — highest practical specificity on every rail button:

```
.side-rail .side-btn, #btn-settings, #btn-blur-self, …
  background: rgba(28, 36, 52, 0.94) !important;
  border: 1px solid rgba(255,255,255,0.28) !important;
  color: #f2f6ff !important;
.side-rail .side-btn .lbl { color: #e8eef7 !important; }
```

   Theme `html[data-theme="…"] .side-btn` rules in `live-themes.css` / matrix block cannot beat this.

2. **Name / loc pills** in the same inline block ~214–241:

```
#local-name.name-on-tile / #local-loc
  background: rgba(12,16,28,0.92) !important;
  color: #eef2f7 !important;
  border: 1px solid rgba(255,255,255,0.22) !important;
```

3. **`ui/live-stage.css` local rail** ~12074–12086:

```
.tile-local .side-rail-right .side-btn { background/border/color hardcoded !important; }
#btn-settings { blue gradient, not --tile-accent }
```

4. **`ui/live-stage.css` remote-rail polish** ~18339–18420:

```
.tile-remote .side-rail-left .side-btn { dark gradient + color:#f2f6ff !important; }
#btn-mute-remote.muted-on / #btn-blur-remote.active { hardcoded rose / blue, not tokens }
```

5. **`.pill.accent`** ~500–504 still hardcoded teal `#0d9488` / `#3dd68c`, not `--tile-accent`. Badges / start CTA later *do* use the token — pills are inconsistent.

### Theme packs already paint sheets, not rails

`live-themes.css` is a large per-selector dump (light/saloon/pink/pixel). It already styles `.side-btn` and `.dock-pill` with hardcoded hex. Adding another pack would duplicate the dump and still lose to live.html inline `!important`.

## Hop refinement (do not expand scope)

- Retarget the **winning** `!important` paint to existing tokens. Do not add a 7th theme. Do not rewrite applyTheme / ICE / live.js.
- Idle chrome: `--tile-chrome-bg-strong` / `--tile-chrome-border` / `--tile-chrome-text` / `--tile-chrome-muted`.
- Active / accent / `.pill.accent` / settings badge: `--tile-accent` / `--tile-accent-2`.
- SVG: leave sprite as `currentColor`; only fix parent `color`.
- Leave `#btn-blur-remote.is-unblur` orange pulse as an action CTA (not theme chrome).
- Optional one-liner aliases (still not a new pack):
  - pixel: `--tile-accent: var(--px-mag)` (or `--px-cyan`)
  - light: keep default rose, or set `--tile-accent` if a distinct light accent is wanted
- Visibility / autohide rules stay as-is (opacity/display only). Do not restyle layout while retargeting color.

## OWN

- `ui/live.html` (inline rail + name/loc pill colors only)
- `ui/live-stage.css` (late `!important` rail / pill / `.pill.accent`)
- `ui/live-themes.css` (optional pixel/light `--tile-accent` alias only)

## Must not

- `ui/live.js`, `ui/webrtc.js`, MediaSession, deploy, APK, hunt remount
- New `data-theme` / new CSS file
- Changing rail autohide, tile identity layout, or FS-hide (already shipped 453–456)

## EVAL

Hop is done when switching Settings theme (dark / light / saloon / matrix / pink / pixel) changes:

1. side-rail button fill + label + SVG stroke
2. name / loc pills
3. `.pill.accent` / start-ish accent chips

without a connect / ICE / live.js diff.

AGREE=yes
GOAL_MET=yes
