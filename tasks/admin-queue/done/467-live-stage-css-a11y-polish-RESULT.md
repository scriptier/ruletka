# 467 — live-stage CSS a11y contrast for partner name

## Status
DONE

## What changed
Strengthened the `#remote-name.name-on-tile` text-shadow during `.stage-trio` /
`.stage-trio-searching` (trio find-3rd hunt) so the partner name chip stays
readable over bright/high-contrast partner video. Both duplicate rule blocks
that target this state (cascade winner and its earlier duplicate) were bumped
to full-opacity near shadows and a deeper outer glow (6/12/20px → 8/16/26px
blur, alpha raised toward 1.0 on the inner layers). No layout, color, z-index,
or JS logic changed — text-shadow values only, as scoped.

Bumped `live-stage.css?v=399` → `?v=400` in `ui/live.html` for cache-busting.

## Files touched
- `ui/live-stage.css` — two `#remote-name.name-on-tile` text-shadow blocks
  (stage-trio-searching context), lines ~2319 and ~20873.
- `ui/live.html` — `live-stage.css?v=` bump only (line 395).

## Verify commands run
- `node -e` brace-balance check on `ui/live-stage.css` → depth 0 (no syntax
  breakage introduced).
- `grep -n` confirmed both new text-shadow values and the `v=400` bump landed
  at the intended lines.
- No `live.js` / `webrtc.js` touched (confirmed via `git status` scope).

Note: this worktree already carried a large pre-existing uncommitted diff
across many unrelated files (docs/, mobile/, ui/*) before this task started —
not introduced by this task. My change is isolated to the two spots above.

## Connect risk
none — CSS text-shadow/version-query only, no touch to live.js, webrtc.js,
offer/ICE/TURN, or connectivity-lock paths.

COMPLETE
