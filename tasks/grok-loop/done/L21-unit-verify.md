# L21 unit verify

## Goal
Run mobile unit smoke and report pass/fail. Fix only if one cheap broken test from SoftBlur/F lanes if any; else RESULT only.

## OWN
- Run: `./scripts/dev-smoke.sh --unit` and/or `node mobile/scripts/verify-match-ux.mjs`
- Optional fix only: `mobile/src/**/*.test.mjs` if one cheap fail
- RESULT: `tasks/grok-loop/done/L21-unit-verify-RESULT.md`

## Done criteria
- [ ] Unit/verify exit 0 or BLOCKED with log
- [ ] RESULT + COMPLETE
- [ ] No invent blur product PASS

## Must not
- SoftBlur Java (F2 OWN), LiveStageVideo (done F4), live.tsx Modal (done F5)
- MediaSession rewrite, ICE, deploy, APK, adb

## Factory
Director tick 2026-08-12 fill-to-5 · unit backlog
