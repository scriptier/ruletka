# BRAND PC watermark spin audit + fix

## Goal
PC mid-match center-seam `ruletka.me` soft 360° every ~15s (skill brand-stage). Fix if broken on disk.

## OWN
- ui/live-brand.css
- ui/live.html (live-brand.css?v= bump only)
- ui/live.js only if has-brand-live never toggles (minimal)

## Work
1. Read brand-stage skill + live-brand.css keyframes.
2. Verify `.stage.has-brand-live .stage-brand-spin` has animation; not killed by stage CSS.
3. Grep live-stage.css for rules that set animation:none on brand-spin.
4. Check setStageBrandLive / has-brand-live in live.js.
5. If spin too subtle or broken: strengthen (ensure animation runs, not reduced-motion default for all users).
6. Bump live-brand.css?v=10→11 if CSS change.
7. RESULT COMPLETE. No invent human PASS. No deploy unless asked.

## RESULT
tasks/grok-loop/done/BRAND-pc-spin-audit-RESULT.md
