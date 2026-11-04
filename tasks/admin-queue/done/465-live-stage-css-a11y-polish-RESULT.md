# 465 — live-stage CSS a11y contrast for partner name — RESULT

## Status
COMPLETE

## What changed
Strengthened the `#remote-name` text-shadow in the FINAL LOCK
`stage-trio-searching` rule (the block that wins the cascade for the PC
find-3rd hunt layout) so the partner name chip stays readable against
bright/high-contrast video during the trio hunt. Added a tight 0-blur
near-black layer on top of the existing outline/glow stack, and bumped the
name's `z-index` from 62 to 65 for extra headroom above the tile-tag (60)
and remote video (5) layers. Background pill (`rgba(8,12,20,0.88)`) and
color were left untouched — this was a text-shadow/z-index-only change as
scoped.

## Files touched
- `ui/live-stage.css` — `.stage.stage-trio(.stage-trio-searching) #remote-name.name-on-tile:not([hidden])` rule (~line 20866, the "FINAL LOCK — PC find-3rd hunt" section)
- `ui/live.html` — bumped `live-stage.css?v=397` → `?v=398`

## Verify commands run
- `node -e "brace depth check"` on `ui/live-stage.css` → balanced (0)
- Grep confirmed `ui/live.html` is the only live reference to
  `live-stage.css?v=`; other hits were docs/task files, out of scope.

## Connect risk
none — CSS-only visual polish, no live.js/webrtc.js/offer/ICE touched.

COMPLETE
