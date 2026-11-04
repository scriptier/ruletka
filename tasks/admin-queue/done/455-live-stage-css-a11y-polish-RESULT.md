# 455 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE

## What changed
`#remote-name.name-on-tile` already renders as an opaque pill (solid `rgba(8,12,20,0.88)`
background + `#eef2f7` text + border), so glyph-on-chip contrast was already solid. The
weak point was the chip itself blending into similarly dark partner video during the
trio hunt. Strengthened the `text-shadow` on the two `stage-trio` / `stage-trio-searching`
`#remote-name` rules (base rule + the later "FINAL LOCK" rule that actually wins the
cascade): tighter near-glyph shadow alpha (0.9→0.95, 0.95→1) for a crisper edge, plus
an added/extended outer glow layer (`0 0 12px` / `0 0 20px` at lower alpha) so the name
stays legible when the dark video behind it is low-light. No background/color/border/
z-index changes — text-shadow only, per scope.

## Files touched
- `ui/live-stage.css` — text-shadow polish on both `#remote-name` trio-hunt rules (~L2311, ~L20866)
- `ui/live.html` — `live-stage.css?v=396` → `?v=397`

## Verify commands run
- `grep -n "v=397" ui/live.html`
- `grep -n "0 0 20px rgba(0, 0, 0, 0.55)" ui/live-stage.css` (confirms both occurrences updated)
- Manual review of cascade: confirmed the later "FINAL LOCK" block (L20866) is the one
  that wins for `.stage.stage-trio.stage-trio-searching #remote-name` (same specificity,
  later source order), so both instances were kept in sync.

## Connect risk
none — CSS-only (text-shadow, version query string), no `live.js`/`webrtc.js`/offer/ICE
changes, no deploy.

COMPLETE
