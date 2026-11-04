# Claude: dev-smoke unit in worktree

## Goal
Run unit tests in freenet-roulette-claude worktree; fix one fail if cheap.

## OWN
- mobile/src/**/*.test.mjs
- mobile/scripts/test-*.mjs

## Done criteria
- [ ] node tests pass or RESULT BLOCKED
- [ ] RESULT + COMPLETE
- [ ] No APK, no adb phone (Grok owns phone)

## Must not
MediaSession rewrite, ICE, deploy, phone adb
