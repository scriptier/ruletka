# Nightly: PC brand spin feel (P0)

## Goal
Make center-seam `ruletka.me` 360° spin more noticeable and polished on PC mid-match without constant spinning.

## Spec
`knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` P0  
Skill: brand-stage

## OWN
- `ui/live-brand.css` only (`@keyframes stage-brand-spin-360-loop`, `.stage-brand-spin`)
- RESULT: `tasks/admin-queue/done/500-brand-spin-feel-css-RESULT.md`

## Do
1. Lengthen spin phase slightly (≈1.8–2.0s of 16–17s cycle) or raise mid scale to ~1.14–1.18
2. Optional: soft glow/box-shadow peak at mid-spin (keyframes)
3. Keep hold upright majority of cycle; full `ruletka.me` never clip
4. Keep `prefers-reduced-motion` static
5. If CSS changes ship-ready: note bump `live-brand.css?v=` in live.html (do not deploy)

## Must not
- MediaSession, webrtc, live.js thrash (unless tiny comment)
- deploy, invent GOAL_MET / human PASS
- put mark on tile bottom; dual tile+seam visible

## Done
RESULT: before/after keyframe summary, cycle math, risk, COMPLETE or BLOCKED
