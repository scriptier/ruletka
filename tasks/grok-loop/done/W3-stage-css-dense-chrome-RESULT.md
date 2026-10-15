# W3 stage CSS dense chrome — RESULT

## Status
COMPLETE

## Goal
`stage-count-4` peer mute/vol chips stay readable (**font-size floors only**).

## OWN
- `ui/live-stage.css`
- `ui/live.html` (`live-stage.css?v=` bump only)

## Changes

### `ui/live-stage.css` → cache `?v=385`

Dense multi block (peer chrome in tiny 4-way / grid cells):

1. **`.peer-mute-btn` font-size floor**  
   Was `0.62rem` (emoji glyph hard to read on dense tiles).  
   Now `font-size: max(0.72rem, 11px) !important` for:
   - `.stage.stage-multi.stage-count-4 .peer-mute-btn`
   - `.stage.stage-multi.stage-layout-grid.stage-count-3 .peer-mute-btn`
   - `.stage.stage-multi.stage-layout-grid.stage-count-4 .peer-mute-btn`  
   Button box size unchanged (`1.35rem`).

2. **`.peer-vol-pct` floor + keep visible**  
   Was `display: none` (pct chip fully dropped).  
   Now visible with `font-size: max(0.62rem, 10px) !important`; `min-width: 0` so dense wrap can still fit.  
   No width/gap/padding thrash on vol wrap or slider.

### `ui/live.html`
- `live-stage.css?v=384` → **`?v=385`** only  
- **No** `live.js` / webrtc / deploy edits

## Verify (static)
- CSS brace balance OK (3302 / 3302)
- Selectors present: mute `max(0.72rem, 11px)`, vol-pct `max(0.62rem, 10px)`
- `live.html` links `live-stage.css?v=385`
- No `live.js` edits

## Smoke (human — not claimed)
- 4-way (or dense grid-3/4): mute 🔊 glyph readable on each peer chrome  
- Vol % text visible and legible next to slider (not blank / not micro)

## Done criteria
- Font-size floors for mute/vol chips; cache bumped; no live.js → **COMPLETE**
