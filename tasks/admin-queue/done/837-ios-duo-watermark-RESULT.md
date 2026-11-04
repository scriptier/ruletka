# 837 — iOS brand mark on 1v1 seam

## Status
COMPLETE

## What changed
`mobile/src/live/BrandWatermark.tsx` previously always drifted the settled
mark down to near the bottom of the stage (`h - BOTTOM_PAD - MARK_HALF_H`,
floored at 120px), regardless of orientation — a fixed "bottom-middle of
partner tile" resting spot with no landscape/portrait distinction.

Mobile web (`ui/live-brand.css`) parks the mark on the partner|you seam:
- **Landscape** (tiles side by side): seam is vertical, mark sits at
  `top: 50%` — plain mid-height, no vertical drift.
- **Portrait** (tiles stack top/bottom): seam is horizontal, mark sits at
  `top: 56%` (see `.stage-brand-center` under
  `@media (max-width: 900px) and (orientation: portrait)`).

Replaced `settleTyForHeight(h)` with `settleTyForStage(w, h)`:
- Compares `w` vs `h` from the root `onLayout` (now tracks width too, not
  just height) to detect landscape vs portrait.
- Landscape → settle fraction `0.5` (stays at mid-height, i.e. no drift).
- Portrait → settle fraction `0.56` (small drift below center, matching the
  web seam offset).
- Dropped the old `MARK_HALF_H`/`BOTTOM_PAD`/120px-floor bottom-anchoring
  math, since the mark no longer parks at the bottom edge.

The mobile app has no true left/right or top/bottom split tile for 1v1 (self
is a small draggable `DraggablePip`, not a fixed-size tile) — so "seam" here
means the same mid-screen resting point mobile web uses for its partner|you
divider, applied to the full-bleed partner stage. Spin/glow/pulse timing and
all other behavior are untouched.

## Files touched
- `mobile/src/live/BrandWatermark.tsx` (only file in OWN)

## Verify commands run
- `cd mobile && npx tsc --noEmit -p .` — zero errors reference
  `BrandWatermark.tsx`; remaining errors are pre-existing repo-wide issues
  (missing native modules like `expo-clipboard`/`expo-av`/`react-native-
  reanimated`, unrelated `app/live.tsx` issues) present before this change.
- `node scripts/verify-match-ux.mjs` — **140 ok, 0 fail**, including
  `OK portrait 1v1: horizontal ruletka.me on seam + actions right` (web-side
  check, confirms web contract untouched) and the BrandWatermark
  export/wiring checks.
- No device/TestFlight smoke available in this sandbox — human should verify
  on a Pixel/iPhone during a live 1v1 match, rotating portrait↔landscape, to
  confirm the mark settles at mid-height (landscape) / just-below-mid
  (portrait) instead of near the bottom.

## Connect risk
none — no MediaSession/ICE/offer/hub files touched; `LiveStageVideo.tsx` and
`liveStyles.ts` untouched per task constraint; change is pure layout math
inside the single owned component.

COMPLETE
