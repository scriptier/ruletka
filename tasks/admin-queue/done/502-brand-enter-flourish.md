# Nightly: PC brand match-enter flourish (P2)

## Goal
One snappy intro 360° (or scale pop) when match goes live, then settle into 16s loop.

## Spec
BRAND-SPIN-IMPROVE-PLAN P2 · skill brand-stage

## OWN
- Prefer CSS-only: `.stage.has-brand-live .stage-brand-spin` animation-delay / secondary keyframe
- If JS needed: only `setStageBrandLive` in `ui/live.js` (one-shot class `brand-enter`) — minimal
- RESULT: `tasks/admin-queue/done/502-brand-enter-flourish-RESULT.md`

## Do
1. Design enter animation ≤1.2s that does not desync loop badly
2. Document approach (CSS only preferred)
3. reduced-motion: no flourish

## Must not
- MediaSession; deploy; thrash match chrome identity

## Done
RESULT + COMPLETE (code optional if clean CSS path found)
