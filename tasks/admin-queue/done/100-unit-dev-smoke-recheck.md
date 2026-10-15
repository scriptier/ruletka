# Claude: unit dev-smoke recheck in worktree

## Goal
Run `./scripts/dev-smoke.sh --unit` in freenet-roulette-claude worktree; RESULT only. Fix one cheap fail if any.

## OWN
unit tests only. No phone adb, no deploy, no APK.

## Done criteria
- [ ] Exit code recorded
- [ ] RESULT + COMPLETE (or BLOCKED)

## Must not
Identity thrash, MediaSession dual rewrite, ICE/TURN, deploy
