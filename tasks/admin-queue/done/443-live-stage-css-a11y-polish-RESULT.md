# 443 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE

## What changed
Strengthened `#remote-name.name-on-tile` text-shadow during `.stage-trio` /
`.stage-trio-searching` (trio hunt) so the partner name chip stays readable
over bright/light dark-video backgrounds. Replaced the single soft shadow
(`0 1px 3px rgba(0,0,0,.9), 0 0 6px rgba(0,0,0,.5)`) with a tighter
high-opacity core plus a wider soft halo
(`0 1px 2px rgba(0,0,0,.95), 0 0 4px rgba(0,0,0,.85), 0 0 10px rgba(0,0,0,.6)`)
in both places this rule is declared (there are two `.stage-trio
#remote-name.name-on-tile` blocks in the file — updated both to keep them
consistent). z-index for the name chip (61, above the tile tag at 60 and the
partner video at 5) was already correct and did not need changes. No
background/layout changes — text-shadow only, per task scope.

## Files touched
- `ui/live-stage.css` — text-shadow strengthened in two `.stage-trio
  #remote-name.name-on-tile` rule blocks (trio hunt contrast)
- `ui/live.html` — `live-stage.css?v=393` → `?v=394` (cache bust only)

## Verify commands run
- `node -e` brace-balance check on `ui/live-stage.css` (0 net depth — no
  syntax breakage introduced)
- `grep` confirmed only one `live-stage.css?v=` reference in `ui/live.html`,
  now bumped
- Visual/browser smoke not run (no dev server started this session); change
  is CSS-only (text-shadow value swap), low risk

## Connect risk
none — no touch to live.js, webrtc.js, offer/ICE/TURN, or CONNECTIVITY_LOCK
paths.

COMPLETE
