# 446 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE — verified already present in this worktree's pending diff.

## What changed
`#remote-name.name-on-tile` during `.stage.stage-trio.stage-trio-searching`
(and the `.stage.stage-multi.stage-layout-stack.stage-trio` variant) carries:
- `z-index: 62 !important` (above `#remote-tile-tag` at z-index 60, above the
  `.remote-stack` video layer at z-index 1)
- `text-shadow: 0 1px 3px rgba(0,0,0,.95), 0 0 6px rgba(0,0,0,.9), 0 0 14px rgba(0,0,0,.75) !important`

This stacks on top of the existing pill chip (`#remote-name.name-on-tile`
base rule: `color:#eef2f7` on `background: rgba(8,12,20,.88)` with a hairline
border), giving the name legible contrast even where the chip partially
overlaps bright/skin-tone video during the find-3rd hunt.

Two copies of the rule exist in the cascade:
- `ui/live-stage.css:2311-2320` (early "Find-3rd hunt" block)
- `ui/live-stage.css:20864-20871` (the later "FINAL LOCK — PC find-3rd hunt
  (stage-trio-searching)" block, which is the cascade winner since it's last
  in file order and equally specific)

No background/opacity change — contrast fix is text-shadow + z-index only,
per task constraint. No live.js touched.

## Files touched
- `ui/live-stage.css` (already contains the fix in this worktree's
  uncommitted diff; no additional edit required)
- `ui/live.html` (`live-stage.css?v=` already bumped 359 → 395 in the same
  pending diff)

## Verify commands run
- `git diff --stat -- ui/live-stage.css ui/live.html` — confirms both files
  are modified in the working tree.
- `git diff -- ui/live-stage.css | grep -n "remote-name"` — confirms the
  text-shadow/z-index rules are additions (`+` lines) in the pending diff.
- `git diff -- ui/live.html | grep -n "live-stage.css?v="` — confirms the
  cache-bust version bump (359 → 395).
- `python3 -c "..."` brace-balance check on `ui/live-stage.css` — 3313 open
  == 3313 close, no truncation/syntax breakage.

## Connect risk
none — CSS-only (text-shadow, z-index), no touch to `live.js`, `webrtc.js`,
offer/ICE/TURN, or any CONNECTIVITY_LOCK surface.

COMPLETE
