# CLEAN: partner rail static re-verify RESULT

**Date:** 2026-08-11  
**Card:** `12-CLEAN-partner-rail-static`  
**Status:** COMPLETE (read-only static disk verify — no product edit)  
**OWN:** READ `ui/live-stage.css` (partner rail / clean chrome), `ui/live.html` pins; optional `ui/live.js` chrome-open hooks only

## Goal

Confirm mid-match partner **left rail** mute · vol · blur forced visible when chrome open; **tile-inline** water 💧 / vol hidden. Document selectors + pins.

## Verdict

| Check | Result |
|-------|--------|
| Left rail mute · vol · blur present in DOM | ✓ PASS |
| Left rail gated by chrome open / always | ✓ PASS |
| Mid-match force-show rail vol + blur (override old clean-hide) | ✓ PASS |
| Rail mute shows with rail (no mid-match hide) | ✓ PASS |
| Tile-inline 💧 force-hide mid-match | ✓ PASS |
| Tile-inline / multi peer-vol force-hide mid-match | ✓ PASS |
| Idle: partner rail off (`:not(.match-live)`) | ✓ PASS |

**Overall: PASS** — clean mid-match block rev “restore partner rail” is on disk; no rewrite needed.

---

## Pins (`ui/live.html`)

| Asset | Pin | Location |
|-------|-----|----------|
| `live-stage.css` | **`?v=391`** | L395 `<link rel="stylesheet">` |
| `live-brand.css` | `?v=15` | L396 (brand lane; not OWN) |
| `live.js` | **`?v=571`** | L397 preload + L3032 `<script defer>` |

```html
<link rel="stylesheet" href="live-stage.css?v=391" />
<link rel="stylesheet" href="live-brand.css?v=15" />
<link rel="preload" href="live.js?v=571" as="script" />
…
<script src="live.js?v=571" defer></script>
```

*(Prior CLEAN-chrome-verify RESULT had v=390 / v=570; pins advanced one step with the restore-rail rev.)*

---

## DOM: partner left rail (`ui/live.html`)

| Role | Element | Notes |
|------|---------|--------|
| Rail container | `#tile-remote > aside.side-rail.side-rail-left` | L882–903 |
| **Mute** | `#btn-mute-remote.side-btn` | Partner mute (P) |
| **Vol** | `.side-vol` → `#remote-vol` + `#remote-vol-pct` | Vertical range |
| **Blur** | `#btn-blur-remote.side-btn` | Rail blur — **not** `.peer-blur-btn` |

### Tile-inline (should stay quiet mid-match)

| Role | Element | Markup |
|------|---------|--------|
| 💧 water | `#btn-blur-remote-main.peer-mute-btn.peer-mute-inline.peer-blur-btn` | L853 `hidden` |
| Tile vol | `#vol-remote-wrap.peer-vol-wrap.peer-vol-inline` → `#vol-remote` | L854–857 `hidden` |
| Multi 💧 | `#btn-blur-remote2`, `#btn-blur-remote-third` | L660, L1040 |
| Multi mute chip | `#btn-mute-remote-main` 🔊 | L852 — not water/vol; residual below |

---

## Selector table: left rail mute / vol / blur visibility

### A. Mid-match clean force-show (rail primary)

**Block:** `ui/live-stage.css` L20921–20967  
`Clean mid-match chrome (2026-08-12, rev: restore partner rail)`

| What | Selector(s) | Rule | OK |
|------|-------------|------|----|
| Rail **vol** capsule | `html.match-live .tile-remote .side-rail-left .side-vol` | `display: flex !important`; `visibility: visible`; `pointer-events: auto` | ✓ |
| Rail **vol** input | `html.match-live .tile-remote .side-rail-left #remote-vol` | same force-show | ✓ |
| Rail **blur** | `html.match-live .tile-remote .side-rail-left #btn-blur-remote` | same force-show (`display: flex`) | ✓ |
| Rail **mute** | `#btn-mute-remote` (inside `.side-rail-left`) | **Not** in any `match-live` hide list; inherits rail chrome open / always | ✓ |

```css
/* Force left-rail partner volume + blur visible when chrome is open / always */
html.match-live .tile-remote .side-rail-left .side-vol,
html.match-live .tile-remote .side-rail-left #remote-vol,
html.match-live .tile-remote .side-rail-left #btn-blur-remote {
  display: flex !important;
  visibility: visible !important;
  pointer-events: auto !important;
}
```

### B. Chrome gate (whole left rail)

**Block:** `ui/live-stage.css` L11949–12118 + inline layout guard in `live.html` L97–170

| Mode | Selector(s) | Effect |
|------|-------------|--------|
| Desktop hide (idle) | `html.chrome-autohide #tile-remote.tile-remote .side-rail-left` | `opacity:0; visibility:hidden; pointer-events:none` |
| Desktop **open** | `html.chrome-autohide #tile-remote.tile-remote.is-chrome-open .side-rail-left` (+ children `> *`) | `opacity:1; visibility:visible; pointer-events:auto` |
| Touch / always | `html.chrome-always #tile-remote.tile-remote .side-rail-left` | force visible |
| Not in call | `html:not(.match-live) .tile-remote > .side-rail.side-rail-left` (L3014–3018) | partner rail off |
| Coarse idle | `@media (hover:none)… html:not(.match-live) .tile-remote .side-rail-left` (L12132) | never force-show rail when not live |

**Net mid-match:** mute · vol · blur are **display-forced** under `html.match-live`, but the **rail shell** still follows chrome autohide — they paint only when:

1. `#tile-remote.is-chrome-open` (pointer enter/move), or  
2. `html.chrome-always` (coarse / touch).

That matches the goal: “forced visible **when chrome open**.”

### C. Compact mobile rail (labels only)

**Block:** `@media (max-width: 900px), (pointer: coarse)` L18972–18995

| Selector | Rule |
|----------|------|
| `html.match-live .tile-remote .side-rail-left .side-btn .lbl` | `display: none` (icon-only) |
| `html.match-live .tile-remote .side-rail-left .side-vol` | `display: flex !important; visibility: visible` — **do not strip slider** |

### D. Layout pins (position, not hide)

| Selector | Rule | Lines |
|----------|------|-------|
| `#tile-remote > .side-rail.side-rail-left` | absolute BL corner | L10769–10778 |
| `html.match-live .tile-remote .side-rail-left` | `bottom: calc(var(--tile-chrome-h) + 0.55rem)` above floor | L18489–18493 |
| `.tile-floor-partner` | `padding-left` clears Mute · vol · Blur stack | L9141–9144, L10799 |

---

## Tile-inline 💧 / vol hide mid-match

| What | Selector(s) | Rule | Lines | OK |
|------|-------------|------|-------|----|
| **Water 💧** (tile + multi only) | `html.match-live .peer-blur-btn`, `#btn-blur-remote-main`, `#btn-blur-remote2`, `#btn-blur-remote-third` | `display:none; visibility:hidden; pointer-events:none` | L20939–20947 | ✓ |
| **Does not hit rail blur** | `#btn-blur-remote` has class `side-btn` only — **no** `.peer-blur-btn` | safe split | live.html L896 | ✓ |
| **Tile / multi vol** | `html.match-live .peer-vol-wrap`, `.peer-vol-inline` | same force-hide | L20948–20954 | ✓ |
| Main tile vol wrap | `#vol-remote-wrap` has both classes | covered by CSS | L854 | ✓ |

```css
/* Tile-inline water 💧 only (not the left-rail blur button) */
html.match-live .peer-blur-btn,
html.match-live #btn-blur-remote-main,
html.match-live #btn-blur-remote2,
html.match-live #btn-blur-remote-third {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
/* Multi/secondary tile volume chips only — main partner volume is left rail */
html.match-live .peer-vol-wrap,
html.match-live .peer-vol-inline {
  display: none !important;
  visibility: hidden !important;
  pointer-events: none !important;
}
```

### JS belt (`applyRemoteMetaVisibility`, `live.js` ~L27998)

Quiet list (force `hidden`):  
`btn-blur-remote-main`, `btn-blur-remote2`, `btn-blur-remote-third`, `vol-remote2-wrap`, `vol-remote-third-wrap`, `remote-peer-conn-chip`.

Unhide rail: `#btn-blur-remote`, `.side-vol` around `#remote-vol`.

Comment: *“Left rail partner mute · volume · blur stay available (autohide with rail).”*

---

## Chrome-open class hooks (`ui/live.js` only)

| Piece | Site | Behavior |
|-------|------|----------|
| `html.match-live` | ~L15513 | toggled with live call |
| `wireTileChromeAutohide` | ~L30296–30434 | desktop: `html.chrome-autohide`; coarse: `html.chrome-always` |
| `CHROME_AUTOHIDE_MS` | **2200** | idle hide delay |
| `showChrome(tile)` | ~L30368 | `tile.classList.add("is-chrome-open")` + schedule hide |
| Events | pointerenter / move / down / leave on `#tile-remote` + `#tile-local` | open / restart timer / leave soon |

---

## Residuals only (no rewrite this hop)

1. **Stale JS comment** `live.js` ~L30292: *“volume/water stripped from rails via CSS”* — **outdated** after restore-rail rev; rails keep vol + blur. Cosmetic doc drift only.  
2. **Force `display: flex` on `#remote-vol`** (range input) — works in practice with parent `.side-vol` column flex; slightly odd property choice vs `display: block` / inherit.  
3. **`#btn-mute-remote` not listed** in the L20956 force-show trio — intentional; mute never was in the old clean-hide set. Visibility is rail-chrome only.  
4. **Tile-inline mute 🔊** `#btn-mute-remote-main`: `setPeerMuteUi` may clear `hidden` when live; **not** CSS-hidden under `match-live` (job scope is water/vol only). CSS still kills 💧/vol. Optional future: hide main tile mute mid-1v1 if dual mute is noisy.  
5. **`setPeerVolUi` / `setPeerBlurUi`** may unhide tile-inline wraps/buttons when live; **CSS `display:none !important` wins** for water/vol — dual gate, OK.  
6. **`applyRemoteMetaVisibility`** does not list `vol-remote-wrap` in the force-hide IDs (only multi wraps); CSS covers main tile vol.  
7. **No large refactor / deploy / MediaSession** — verified read-only.

---

## Diff vs prior CLEAN-chrome-verify

| Prior (hide-all) | Now (restore partner rail) |
|------------------|----------------------------|
| Hid `#btn-blur-remote` + `.side-vol` + `#remote-vol` mid-match | Force-**show** those on left rail |
| Tile-inline + rail blur both killed via `#btn-blur-remote` in hide list | Tile-inline only via `.peer-blur-btn` / `*-main/2/third` |
| Pins `live-stage.css?v=390` · `live.js?v=570` | **`?v=391` · `?v=571`** |

---

## Done

- Selector table documented (rail show + tile-inline hide + chrome gate).  
- Pins recorded.  
- Residuals noted only — **no** dual-write to `live-stage.css`.  
- Card moved to `tasks/grok-loop/done/`.
