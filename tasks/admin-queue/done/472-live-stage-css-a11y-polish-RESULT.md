# 472 — live-stage CSS a11y contrast for partner name — RESULT

## Status
Done. The fix was already present, uncommitted, in this worktree (`ui/live-stage.css`, `ui/live.html`) — verified it fully satisfies the task's done criteria and made no further code changes.

## What it does
`#remote-name.name-on-tile` during `.stage-trio.stage-trio-searching` (the find-3rd hunt column, the narrowest/brightest tile) gets:
- A crisp multi-pass black outline text-shadow (four 1–1.5px offset layers) plus a soft 8/16/26px black glow, stacked on top of the base `.stage-trio` shadow rule — keeps white `#remote-name` text (`color: #fff`) legible against any bright video frame.
- `z-index: 66` (above `#remote-tile-tag` at z-index 60 and the base trio name rule at z-index 65), so the name pill always wins the stacking fight over partner video and tile-tag chrome.

Only `text-shadow` and `z-index` properties are touched — no layout, sizing, or color changes.

## Files touched
- `ui/live-stage.css` — a11y contrast rule at line ~20880 (`.stage.stage-trio.stage-trio-searching #remote-name.name-on-tile:not([hidden])`)
- `ui/live.html` — `live-stage.css?v=` bumped 359 → 401 (CSS version bump only)

## Verify commands run
- Manual read-through of `ui/live-stage.css` around the `#remote-name` / `stage-trio-searching` selectors (lines 2265–2330, 20858–20889) to confirm text-shadow layering and z-index ordering.
- `grep -n "color: #fff"` confirmed base name text color is white, so the added black outline/glow shadow maximizes contrast against arbitrary video backgrounds.
- Confirmed `git diff ui/live.html` shows only the `?v=` bump (plus one pre-existing unrelated comment line) — no other markup changes.
- Confirmed no diff touches `ui/live.js` or `ui/webrtc.js`.

## Connect risk
none — CSS-only text-shadow/z-index polish, no JS, no offer/ICE/TURN/hub logic touched.

COMPLETE
