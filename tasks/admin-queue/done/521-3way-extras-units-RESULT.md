# 521 — extras>=1 split + extraPeersFromMatch unit tests — RESULT

Status: DONE

## What changed

Extended the two pure-logic test mirrors that guard the extras>=1 / 3rd-join
paths. No source files touched (`matchPeers.ts`, `stageStreams.ts`,
`live.tsx`, `webrtc.js`, `MediaSession.ts`, `LiveStageVideo.tsx` all
untouched, per task scope).

### `mobile/src/live/matchPeers.test.mjs`
- Fixed a mirror/source drift: the test file's local `extraPeersFromMatch`
  mirror only excluded the primary peer via exact `===` id match. The real
  `matchPeers.ts` also excludes via `peerIdsLooseMatch` (handles `fed/`
  prefix stripping and 8-char hex prefix matching). Updated the mirror to
  match the source exactly, then added regression tests proving a
  differently-formed primary id (fed/-prefixed, short-vs-full hex) is still
  excluded from extras — this is exactly the 3rd-join rematch case where hub
  may hand back the primary's id in a new form.
- Added a `pickPrimaryPeerIndex` mirror (was not mirrored/tested at all
  previously, despite being named in the task) with tests for: fresh match
  (index 0), exact-match reorder, loose-match id-form change, fallback to
  `prevSecondary` when primary left, default-to-0 when neither found,
  `"legacy"` ids never treated as real, and empty `peerIds`.

### `mobile/src/live/stageStreams.test.mjs`
- Added an explicit test tying `isLookingForThird` (hunt signal) directly to
  `pickStageStreams.multiRemote` and `pickStageChromeLayout.includeLocalTile`
  in the same assertion block: hunting alone with one partner (extras=0, no
  stream2/3) must report `multiRemote: false`, `remoteCount: 1`, and
  `includeLocalTile: false` even though hunt chrome wraps
  (`wrapFirstPartner: true`). Prior coverage exercised these facts
  separately; this locks the specific "hunt ≠ multiRemote" invariant named
  in the task in one place.

(extras>=1 showing a connecting tile even when `remoteStream2` is null was
already thoroughly covered by existing tests — `shouldShowExtraRemoteTile`,
`pickStageChromeLayout` extras-join cases, the 223218Z regression block, and
the source-contract lock at the bottom of the file — so no new test was
needed there beyond confirming it still passes.)

## Files touched
- `mobile/src/live/matchPeers.test.mjs`
- `mobile/src/live/stageStreams.test.mjs`

## Verify commands run
```
node mobile/src/live/matchPeers.test.mjs   → "matchPeers.test.mjs OK", exit 0
node mobile/src/live/stageStreams.test.mjs → "stageStreams.test.mjs: ok", exit 0
```

## Connect risk
none — test-only changes, no source/runtime files edited.

COMPLETE
