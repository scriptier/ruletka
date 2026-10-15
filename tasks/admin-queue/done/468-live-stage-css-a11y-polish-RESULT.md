# 468 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE

## What changed
Added an extra scoped rule for `#remote-name.name-on-tile` during
`.stage-trio.stage-trio-searching` (the find-3rd hunt column) with a
tighter, denser black text-shadow outline (eight 1.5px offset layers
plus the existing glow/drop-shadow stack) and bumped its `z-index` to
66 (was 65) so the name chip always wins contrast against the bright
partner video feed in that narrow column. Left the pre-existing
general `.stage-trio` rule (line 20866) untouched — the new rule is
additive and only fires in the searching state, per the task's
text-shadow/z-index-only scope.

## Files touched
- `ui/live-stage.css` — added scoped a11y contrast rule after the
  existing "FINAL LOCK" `#remote-name` block (~line 20878).
- `ui/live.html` — bumped `live-stage.css?v=400` → `?v=401`.

## Verify commands run
- `node -e "brace-balance check on ui/live-stage.css"` → depth 0 (no
  syntax breakage).
- `git diff` reviewed to confirm the edit is isolated to the intended
  lines (repo has large pre-existing uncommitted diffs from other
  work in this tree; my change is a single new CSS block + one `?v=`
  bump).

## Connect risk
none — no touches to `ui/live.js`, `ui/webrtc.js`, offer/ICE/TURN, or
CONNECTIVITY_LOCK. CSS-only, additive selector, no deploy.

COMPLETE
