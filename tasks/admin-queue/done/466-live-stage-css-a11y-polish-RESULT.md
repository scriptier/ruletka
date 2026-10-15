# 466 — live-stage CSS a11y contrast for partner name — RESULT

## Status
COMPLETE

## What changed
Investigated `#remote-name` (partner name chip) readability during `stage-trio-searching`
(the find-a-3rd hunt). The dark opaque chip background + heavy multi-layer `text-shadow`
contrast treatment for this state was already present in the working tree (two duplicate
rule blocks: an older one and a newer "FINAL LOCK" block with a stronger shadow and
`z-index: 65`).

Found a real bug while verifying it: the newer/stronger "FINAL LOCK" block
(`ui/live-stage.css:20866`) was missing the mobile stacked-layout selector combo
(`.stage-multi.stage-layout-stack.stage-trio.stage-trio-searching`) that its sibling rule
for `#remote-tile-tag` right above it already has. Because of that omission, on mobile
(stage-layout-stack) the *older*, weaker rule at `ui/live-stage.css:2311` was winning the
cascade for `#remote-name` — it has higher CSS specificity (an extra ancestor class) than
the newer rule, even though it's earlier in source order. Result: mobile users in trio
hunt got the older `z-index: 62` / lighter shadow instead of the intended `z-index: 65` /
heavier shadow.

Fixed by adding the missing mobile-stack + searching selector to the FINAL LOCK block so
it now has equal-or-higher specificity than the older rule and wins consistently across
desktop and mobile stacked layouts.

## Files touched
- `ui/live-stage.css` — added one selector to the `#remote-name` contrast block at line
  ~20866 (`.stage.stage-multi.stage-layout-stack.stage-trio.stage-trio-searching
  #remote-name.name-on-tile:not([hidden])`). No property values changed — text-shadow /
  z-index only, per task scope.
- `ui/live.html` — bumped `live-stage.css?v=398` → `?v=399`.

## Verify commands run
- Manual CSS specificity audit (no build step for this static CSS file): confirmed the
  new selector's specificity (5 classes + 1 ID + `.name-on-tile` + `:not([hidden])`) now
  exceeds the previously-winning mobile-stack rule at line 2313.
- `grep -rn "live-stage.css?v=" ui/*.html` — confirms single, consistent version
  reference.
- No JS/build/test suite applies to this static CSS/HTML edit; no `tsc`/node test
  scripts are relevant to `ui/`.

## Connect risk
none — CSS-only change (`text-shadow`/selector scope for one `z-index` rule), no
`live.js`, no offer/ICE/TURN/MediaSession touch, no deploy.

## Note for Grok
This worktree already had a large pre-existing uncommitted diff to `ui/live-stage.css`
(2000+ lines, unrelated to this task — other in-flight polish work) when this task
started. I only touched the `#remote-name` contrast rule and the one `?v=` line per OWN
scope; did not refactor or revert any of the surrounding pre-existing changes.

COMPLETE
