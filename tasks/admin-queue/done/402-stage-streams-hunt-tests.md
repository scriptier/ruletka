# stageStreams / multi tile unit tests for hunt + 3 remotes

## Goal
Expand `mobile/src/live/stageStreams.test.mjs` to cover MAX_REMOTE_TILES=3 and document hunt is LiveStageVideo not stageStreams.

## OWN
- `mobile/src/live/stageStreams.test.mjs`
- `mobile/src/live/stageStreams.ts` only if test requires tiny export

## Done criteria
- [ ] `node mobile/src/live/stageStreams.test.mjs` exits 0
- [ ] Tests for pickMultiRemoteTiles focus order + 3 remotes
- [ ] RESULT + COMPLETE
- [ ] No APK

## Must not
- live.tsx MediaSession rewrite
