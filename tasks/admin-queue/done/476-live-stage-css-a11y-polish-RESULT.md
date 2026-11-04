# 476 RESULT — live-stage CSS a11y contrast for partner name

**Status:** COMPLETE

## What changed

`#remote-name` during `stage-trio-searching` (PC find-3rd hunt) already had a
prior a11y pass tuned for **bright** hunt video: a crisp black text-outline
stack + raised z-index. That handled white text washing out on light video,
but a fully black-shadowed pill gives no extra separation against a
**near-black / low-light** partner feed, where the pill can visually flatten
into the frame even though the base contrast ratio (light text on the
`rgba(8,12,20,0.88)` pill background) stays technically fine.

Added a soft light bloom layer *behind* the existing black outline in the
`#remote-name.name-on-tile` text-shadow stack (`0 0 5px rgba(255,255,255,0.3),
0 0 10px rgba(255,255,255,0.16)`), so the chip pops in both directions —
crisp dark edge on bright video, soft light halo on dark video — without
touching background/border/opacity. Left z-index values untouched; existing
stacking order (63 / 66, above the empty-state and looking-brand layers) was
already correct with no conflicting `z-index` above it in the trio-searching
subtree.

live-stage.css has two near-duplicate `stage-trio-searching` blocks for this
selector (an earlier one and a later "FINAL LOCK" one with the same
specificity, which wins the cascade by source order). Updated both to keep
them in sync, matching the file's existing paired-block pattern.

## Files touched
- `ui/live-stage.css` — text-shadow only, in the two existing a11y comment
  blocks for `#remote-name.name-on-tile` under `.stage-trio-searching`
  (~L2311-2337 and ~L20878-20901)
- `ui/live.html` — `live-stage.css?v=402` → `?v=403` (cache bust only)

## Verify
- `node -e` brace-depth check on `ui/live-stage.css` → balanced (0)
- `grep -n "live-stage.css?v="` confirms bump to 403
- No `live.js` / `webrtc.js` touched; no deploy

## Connect risk
none — CSS-only text-shadow addition on an existing selector, no layout,
JS, or CONNECTIVITY_LOCK-relevant change.

COMPLETE
