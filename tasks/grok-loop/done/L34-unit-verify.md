# L34 unit verify

## Work
```bash
cd /home/drakosik/freenet-roulette
./scripts/dev-smoke.sh --unit
node mobile/scripts/verify-match-ux.mjs
```
RESULT: `tasks/grok-loop/done/L34-unit-verify-RESULT.md`
Optional one cheap test-side fix only. No invent blur/multi product PASS.

## OWN
Read-only preferred. RESULT path above.

## Must not
SoftBlur/MediaSession thrash, force-push, APK, adb, live.js dual-write
