# Run mobile unit smoke and fix one broken test if any

## Goal
Run node mobile unit tests / scripts/dev-smoke unit path; fix one failing test only if cheap.

## OWN
- mobile/src/**/*.test.mjs (fix only)
- mobile/scripts/* only if test harness needs it

## Done criteria
- [ ] Tests pass or RESULT BLOCKED with log
- [ ] RESULT + COMPLETE
- [ ] No APK

## Must not
- Deploy, ICE thrash


## Factory
Auto-enqueued 2026-08-12T01:52:46Z by auto-enqueue-backlog.sh
When done: RESULT in tasks/admin-queue/done/422-dev-smoke-unit-run-RESULT.md with COMPLETE
