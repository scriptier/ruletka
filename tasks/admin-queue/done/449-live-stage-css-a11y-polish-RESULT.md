# 449 — live-stage CSS a11y contrast for partner name — RESULT

## Status
COMPLETE

## Summary
`#remote-name` (name-on-tile chip) contrast during `stage-trio-searching` (find-3rd hunt)
was audited in `ui/live-stage.css`. The worktree already carried the needed fix (staged,
uncommitted, alongside other in-flight hunt-layout work in the same shared worktree):

- `.stage.stage-trio #remote-name.name-on-tile:not([hidden])` and the
  `.stage.stage-trio.stage-trio-searching` / `.stage-multi.stage-layout-stack.stage-trio`
  variants (two selector blocks, ~line 2311 and ~line 20866) raise the name chip to
  `z-index: 62 !important` — above the partner `<video>` (`z-index: 5`) and the
  tile-tag chrome (`z-index: 60`) — and apply a 7-layer `text-shadow` (four tight
  ±1px black outline passes + a 3-stop dark glow) so the name stays legible whether
  the live partner video behind it is dark or bright/skin-toned.
- I verified there is no later, higher-specificity `!important` rule that clobbers
  this (checked every `text-shadow: none` in the file — all are unrelated
  `data-theme="matrix"` / unrelated component rules, none target `#remote-name` and
  none carry `!important`, so they can't win the cascade against the trio rule).
- `ui/live.html` already references `live-stage.css?v=396` (bumped from the committed
  `?v=359` baseline), so the version-bump criterion is satisfied.

No further edit was needed to meet the goal (name chip readable on dark video during
trio hunt, via text-shadow/z-index only) — making an additional change on top would
have been redundant given the existing shadow/z-index stack already covers it.

## Files touched
None — audited only. `ui/live-stage.css` and `ui/live.html` already carried the
relevant changes (uncommitted, pre-existing in this shared worktree) before I started.

## Verify commands run
- `node -e` brace-balance check on `ui/live-stage.css` → depth ends at 0 (valid CSS,
  no unclosed rules).
- `grep -n "live-stage.css?v=" ui/live.html` → confirms `?v=396`.
- Manual selector/cascade review for `#remote-name` z-index + text-shadow rules and
  any conflicting `text-shadow: none` rules elsewhere in the file.
- No dev server / browser smoke run (static CSS-only change, no live.js touched).

## Connect risk
none — no `live.js`, `webrtc.js`, offer/ICE/TURN, or MediaSession changes.

COMPLETE
