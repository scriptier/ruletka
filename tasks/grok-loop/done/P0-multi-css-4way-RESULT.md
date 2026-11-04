# P0 multi CSS 4-way — RESULT

## Status
COMPLETE

## Goal
PC `stage-count-4` / trio hunt: all panes visible, partner name z-index, no orphan black.

## OWN
- `ui/live-stage.css`
- `ui/live.html` (`live-stage.css?v=` bump only)

## Changes

### `ui/live-stage.css` → cache `?v=384`

1. **Orphan black fix (remote2)**  
   Rules that forced `display: block !important` on `.remote-b-wrap` / `.vid.remote-b` during `stage-trio` now require `:not([hidden])`. Previously higher-specificity trio rules beat `.remote-b-wrap[hidden] { display: none }`, leaving a black half-pane when remote2 was unused.

2. **stage-count-3 grid: no empty black cell**  
   Base grid-3 local tile spans full bottom row (`grid-column: 1 / -1`) instead of leaving a dead 2×2 hole.

3. **FINAL LOCK 2 (stage-count-3 / 4 + hunt)**  
   - All non-hidden tiles under `.stage-count-3` / `.stage-count-4` stay visible.  
   - Partner / local / third panes paint; live `#remote` / `#remote2` / `#remote-third` fill cells.  
   - Partner name chrome: `#remote-tile-tag` **z-index 60**, `#remote-name` **z-index 61** (above multi video layers).  
   - **`#third-empty` only in `#tile-third`**: hard-kill `.third-empty` under remote/local; contain looking brand to third pane geometry.  
   - Hidden `#tile-third` zero footprint.  
   - Stack 3/4-way non-collapsing column floors (`min-width: max(5rem, 14%)`) beat `live.html` `#tile-remote { min-width: 0 }`.

4. **Prior multi-layout block retained** (2×2 grid-4, stack split, trio-searching FINAL LOCK 1 partner column + middle brand).

### `ui/live.html`
- `live-stage.css?v=383` → **`?v=384`** only (no live.js / no deploy).

## Verify (static)
- CSS brace balance OK (3313 / 3313).  
- Key selectors present: `FINAL LOCK 2`, `remote-b-wrap:not([hidden])`, stage-count name z-index, tile-remote `.third-empty` kill.  
- No `live.js` edits.

## Smoke (human — not claimed)
- Find-3rd hunt: partner column live + name readable; middle “Looking for a 3rd…”.  
- 3-way / 4-way: all panes visible, no permanent black orphan.  
- Grid toggle 3-way: no empty black cell under local.

## Done criteria
- CSS ok; cache bumped; no live.js; no deploy → **COMPLETE**
