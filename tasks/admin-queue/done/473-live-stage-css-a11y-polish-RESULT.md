# 473 — live-stage CSS a11y contrast for partner name

## Status
COMPLETE

## What changed
- `ui/live-stage.css`: added a dedicated a11y rule for `#remote-name.name-on-tile` scoped to `.stage-trio.stage-trio-searching` (desktop/base breakpoint, no media query). It layers a crisper, tighter multi-directional black text-shadow outline (0/1px/1.5px passes) plus a bumped `z-index: 63` (over the base rule's `62`) so the partner name pill wins contrast against bright video specifically during the trio hunt. Mirrors the existing mobile-landscape a11y treatment already present later in the file (`@media (max-width: 900px) and (orientation: landscape)`), which was previously the only breakpoint with this stronger outline.
- `ui/live.html`: bumped `live-stage.css?v=401` → `?v=402` (cache-bust only).

## Files touched
- ui/live-stage.css
- ui/live.html

## Verify commands run
- Manual review of `.stage-trio-searching #remote-name` selectors across the file (desktop base rule ~L2311, mobile landscape a11y rule ~L20880) to confirm the new rule doesn't conflict and correctly increases specificity/z-index only.
- No build step for this repo's `ui/*` static CSS/HTML; no automated test available for visual contrast. Recommend a manual phone+PC smoke of stage-trio-searching to eyeball the name chip against bright partner video.

## Connect risk
none — CSS-only (text-shadow/z-index), no live.js/webrtc.js/offer/ICE changes.

COMPLETE
