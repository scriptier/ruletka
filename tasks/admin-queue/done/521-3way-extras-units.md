# Unit tests — extras>=1 split + extraPeersFromMatch

## Goal
Extend existing unit tests so extras>=1 connecting tile and 3rd-join extraPeersFromMatch cannot regress.

## OWN
- `mobile/src/live/matchPeers.test.mjs`
- `mobile/src/live/stageStreams.test.mjs`

## Read
- `mobile/src/live/matchPeers.ts` (`extraPeersFromMatch`, `pickPrimaryPeerIndex`)
- `mobile/src/live/stageStreams.ts` (`extraJoining`, `shouldShowExtraTile`, hunt vs extras)
- `knowledge/specs/2026-08-14-3way-cameras-plan.md`

## Must not
- Edit live.js, webrtc.js, MediaSession.ts, LiveStageVideo.tsx, matchPeers.ts, stageStreams.ts
- deploy, APK, invent product pass

## Done
- Tests cover: extraPeersFromMatch excludes primary; extras>=1 shows connecting extra even if remoteStream2 is null; hunt is not multiRemote when extras=0
- `node mobile/src/live/matchPeers.test.mjs` exit 0
- `node mobile/src/live/stageStreams.test.mjs` exit 0
- RESULT in `tasks/admin-queue/done/521-3way-extras-units-RESULT.md` after harvest
- COMPLETE
