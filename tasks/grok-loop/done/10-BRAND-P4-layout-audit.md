# BRAND-P4: multi layout place audit (read-only)

## Goal
Confirm center seam place for 1v1 / trio / grid; document residual. **No CSS write this hop** (P3 owns `live-brand.css`).

## Spec
BRAND-SPIN-IMPROVE-PLAN P4 · brand-stage

## OWN
- READ: `ui/live-brand.css`, `ui/live.html` `#stage-brand-center` / layout classes
- WRITE RESULT only: `tasks/grok-loop/done/BRAND-P4-layout-audit-RESULT.md`

## Do
1. Table: layout class → left % / place expected (duo 50%, trio ~33.3% seams, grid center)
2. Note 4-way grid vs trio seam + narrow mobile
3. Flag clear place bugs for a later fix hop — **do not edit CSS this hop**

## Must not
- write live-brand.css (P3 concurrent)
- MediaSession; multi media thrash; invent multi PASS; deploy

## Done
RESULT COMPLETE with layout table


---
**Status:** COMPLETE
**RESULT:** `tasks/grok-loop/done/BRAND-P4-layout-audit-RESULT.md`
