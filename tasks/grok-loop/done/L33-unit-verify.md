# L33 unit verify

## Goal
Run unit + match-ux verify. Optional one cheap test fix only if fail is test-side.

## Work
```bash
cd /home/drakosik/freenet-roulette
./scripts/dev-smoke.sh --unit
node mobile/scripts/verify-match-ux.mjs
```
RESULT with exit codes / counts. No invent blur/multi product PASS from unit green.

## OWN
- Read-only preferred; optional tiny pure test fix only if unit fail is test-side
- RESULT: `tasks/grok-loop/done/L33-unit-verify-RESULT.md`

## Must not
SoftBlur/MediaSession thrash, invent blur PASS, force-push, APK/deploy, adb, live.js dual-write
