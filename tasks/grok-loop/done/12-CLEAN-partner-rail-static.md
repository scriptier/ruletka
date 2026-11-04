# CLEAN: partner rail static re-verify

## Goal
Confirm mid-match partner left rail: mute · vol · blur forced visible when chrome open; tile-inline water/vol hidden. Document selectors + pins.

## OWN
- READ: `ui/live-stage.css` (partner rail / clean chrome blocks), `ui/live.html` pins
- optional READ `ui/live.js` for chrome-open class hooks only
- RESULT: `tasks/grok-loop/done/CLEAN-partner-rail-static-RESULT.md`

## Do
1. Table selectors: left rail mute/vol/blur visibility rules
2. Confirm tile-inline 💧/vol hide mid-match
3. Pins: live-stage.css?v= · live.js?v=
4. Note residual only — no large rewrite

## Must not
- large refactors; deploy; MediaSession
- dual-write live-stage.css if another hop editing it (prefer RESULT-only)

## Done
RESULT COMPLETE with selector table
