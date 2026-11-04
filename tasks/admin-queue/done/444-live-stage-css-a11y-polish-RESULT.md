# 444 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE

## What changed
Strengthened `#remote-name` legibility on dark/video backgrounds during `stage-trio-searching`
(trio hunt). Two rule blocks in `ui/live-stage.css` govern this selector (an earlier "Name chrome"
block and the later "FINAL LOCK — PC find-3rd hunt" block, which wins the cascade); both were
updated identically for consistency:
- `text-shadow`: widened from a 3-layer `2px/4px/10px` stack to a stronger `3px/6px/14px` stack
  with higher alpha (0.9 / 0.75 outer layers) for better readability over bright/moving video.
- `z-index`: bumped `61` → `62` (still above `#remote-tile-tag` at `60` and partner video at `5`,
  just given a touch more headroom).

No layout, color, or background changes — chip already had an opaque dark background
(`rgba(8,12,20,0.88)`) from the base `.name-on-tile` rule; this is a pure contrast/legibility
polish on top of that.

## Files touched
- `ui/live-stage.css` (lines ~2311–2320 and ~20864–20871)
- `ui/live.html` (css version bump only, `live-stage.css?v=394` → `?v=395`)

## Verify commands run
- `grep -n "z-index: 62 !important" ui/live-stage.css` — confirms both `#remote-name` blocks updated.
- Manual read-through of `.stage.stage-trio.stage-trio-searching #remote-name` cascade to confirm
  the FINAL LOCK block (later in file, same specificity) is the one that wins and was updated.
- No build/lint step exists for this static CSS/HTML pair; no automated test suite covers visual
  contrast, so verification was via source review only (no live browser smoke run in this pass).

## Connect risk
none — CSS-only (text-shadow/z-index), no `live.js`, no WebRTC/ICE/hub code touched.

## Notes
- The working tree already had substantial pre-existing uncommitted changes across `mobile/`,
  `docs/`, and `ui/` from another agent before this task started (per repo convention, only the
  two scoped rule blocks + version bump above were touched — nothing else was "helpfully" cleaned up).

COMPLETE
