# L22 unit verify

## Goal
Re-run unit + verify-match-ux after F7 default-hold + F6 APK era. RESULT only unless one cheap fail.

## OWN
- `./scripts/dev-smoke.sh --unit`
- `node mobile/scripts/verify-match-ux.mjs`
- Optional one cheap test fix in `mobile/src/**/*.test.mjs`
- RESULT: `tasks/grok-loop/done/L22-unit-verify-RESULT.md`

## Must not
- SoftBlur Java, LiveStageVideo product thrash, APK, adb, invent blur PASS

## Factory
Director tick · unit backlog
