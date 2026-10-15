# BRAND disk pin v=16 recheck (read-only + docs)

## Goal
Confirm PC brand pin on disk: `live-brand.css?v=` matches shipped intent (**v=16** per BRAND-SPIN-IMPROVE-PLAN). Grep `ui/live.html` + note brand spin stack state. **No invent human GOAL_MET / spin PASS.**

## OWN
- Read: `ui/live.html`, `ui/live-brand.css`, `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md`
- Optional one residual stamp on BRAND-SPIN-IMPROVE-PLAN only (pin reconfirm; human smoke still open)
- RESULT: `tasks/grok-loop/done/BRAND-disk-pin-16-recheck-RESULT.md`
- Card → `done/` when COMPLETE

## Work
1. `grep -n 'live-brand.css' ui/live.html`
2. Confirm pin vs plan table (v=16)
3. Note P0–P5 residual; no CSS/JS product thrash unless pin mismatch needs tiny `?v=` bump only — prefer report-only if pin already correct
4. Honest RESULT: pin OK/mismatch; human smoke still open

## Must not
MediaSession, live.js thrash, invent GOAL_MET, force-push, APK, adb, dual-write live-stage.css (Claude 474 owns a11y polish)
