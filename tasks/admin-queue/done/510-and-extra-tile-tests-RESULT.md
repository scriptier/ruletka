# 510: Android extra-tile unit lock (3-way split) — RESULT

## Status
COMPLETE — verified, no code changes needed this pass. The extras≥1 second-remote-slot
logic and its unit coverage were already present in the worktree (`mobile/src/live/`
is uncommitted WIP from earlier work) and match the task's Done criteria exactly.

## What was checked
- `stageStreams.ts`: `shouldShowExtraRemoteTile`, `shouldLockFirstRemote`,
  `pickStageChromeLayout` all treat `extraPeerCount >= 1` as enough to open a
  second remote slot / split layout even before `remoteStream2` binds — this is
  the fix for the 221222Z FAIL (phone stuck 1v1 Laptop-only despite extras≥1).
- `stageStreams.test.mjs`: covers extras=1 with `remoteStream2: null` for
  `shouldShowExtraRemoteTile` (→ true), `shouldLockFirstRemote` (→ true),
  `pickStageChromeLayout` (`people: 3`, `wrapFirstPartner: true`,
  `portraitColumn: true`), plus the hunting→second-remote-lands transition
  (`wrapFirstPartner` must not flip false→true→false to avoid remounting the
  1v1 RTCView) and `pickMultiTiles` placeholder-tile behavior when stream2 is
  still null.
- `LiveStageVideo.tsx`: wires `extraJoining = extraPeerCount >= 1 && !remoteStream2`
  into `multiRemote`, so extras≥1 alone flips `splitStage` on and renders the
  top/bottom split — not gated on `remoteStream2` landing first.
- `liveStyles.ts`: `splitRemote`, `splitRemoteWide`, `splitRemoteGrid2x2`,
  `splitHuntTile*` styles all already exist; nothing missing to block the split.

## Files touched
None (verification only — implementation was already in place).

## Verify commands run
- `node mobile/src/live/stageStreams.test.mjs` → `stageStreams.test.mjs: ok`

## Connect risk
none (no code changed; verification only)

COMPLETE
