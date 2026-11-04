# Unit: stageStreams + matchContinuity still green after 3-way layout hops

## Goal
Re-run existing unit tests for Android stage layout. If a small assertion is missing for "2 remotes => split + pip you" or "2x2 only at 4", add **one** test in OWN files only.

## OWN
- `mobile/src/live/stageStreams.test.mjs`
- `mobile/src/live/matchContinuity.test.mjs`
- Read-only: `stageStreams.ts` (edit test only unless a one-line export is required — then stop and note)

## Done
- [ ] `node mobile/src/live/stageStreams.test.mjs` ok
- [ ] `node mobile/src/live/matchContinuity.test.mjs` ok
- [ ] RESULT + COMPLETE

## Must not
- MediaSession, live.tsx, live.js, deploy, APK
- Invent MULTI_PASS
