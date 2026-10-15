# 442 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE

## What changed
Added a `text-shadow` safety net to `#remote-name.name-on-tile` specifically in the
`stage-trio` / `stage-trio-searching` (trio hunt) selectors, so the partner name chip
stays readable if it renders over bright/high-contrast video even though it already
sits on a dark pill background. z-index (61) was already correctly layered above the
video (`.remote-stack` z-index 1, tag chrome z-index 60) — confirmed no bump needed.

## Files touched
- `ui/live-stage.css` — two `.stage.stage-trio(.stage-trio-searching) #remote-name.name-on-tile:not([hidden])` rule blocks (~line 2311 and ~line 20863) each gained:
  `text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.5) !important;`
- `ui/live.html` — bumped `live-stage.css?v=392` → `?v=393`

## Verify commands run
- `grep -rn "live-stage.css?v=" ui/` — confirmed only one reference, now `v=393`.
- `git diff -- ui/live-stage.css ui/live.html` — confirmed only the two text-shadow additions and the version bump are attributable to this task (repo had pre-existing unrelated dirty state in these files from before this session, untouched by me).

## Connect risk
none — CSS-only, text-shadow/z-index scoped to `#remote-name` in the trio-search state; no `live.js` / `webrtc.js` / offer / ICE / TURN changes.

COMPLETE
