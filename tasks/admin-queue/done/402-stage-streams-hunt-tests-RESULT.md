# 402 — stageStreams multi-tile unit tests (hunt vs stageStreams)

## Status
COMPLETE

## What changed
Expanded `mobile/src/live/stageStreams.test.mjs` (test-only, no production code changed):

1. Added a doc-comment block at the top of the test file clarifying that
   "hunting" / find-3rd split UI (`huntingWithPartner` / `huntingThird`,
   top=partner + bottom="Looking for a 3rd…" strip) is **not** modeled by
   `stageStreams.ts`. That state lives entirely in `LiveStageVideo.tsx` +
   `app/live.tsx`, which deliberately keep `pickMultiTiles`/multi-remote
   layout out of the picture while hunting alone with one partner (see
   `LiveStageVideo.tsx`: "Real multi only (2 remotes). Hunt layout uses 1v1
   VideoView + looking strip."). `stageStreams.ts` only orders/picks streams
   once real remote streams exist — it has no concept of "hunting".
2. Added new test cases:
   - `pickMultiRemoteTiles`: focus on the middle remote (index 1) of three,
     verifying stable relative order of the other two.
   - `pickMultiRemoteTiles`: out-of-range `focusIndex` (too high / negative)
     clamps into `[0, n-1]`.
   - `pickMultiRemoteTiles`: `isExtra`/`placeholder` flags are correct across
     all 3 slots, including a still-connecting (null-stream) middle remote.
   - `pickMultiRemoteTiles`: empty `remotes` array returns `[]`.
   - `pickMultiTiles`: third remote stream present but no `thirdName` still
     produces a `tileC` with the default placeholder name.
   - `pickMultiTiles`: no third stream and no `thirdName` stays 2-way (no
     `tileC`), confirming `pickMultiTiles` doesn't silently render a 3rd tile
     unless the hub explicitly gave a stream or name.
   - `pickStageStreams`: `remoteCount` still caps at `MAX_REMOTE_TILES` (3)
     even when `extraPeerCount` is much larger (10).

Also confirmed (research, no code change needed): `LiveStageVideo.tsx` only
calls `pickMultiTiles` (2-remote API, with optional `remoteStream3`) — it
never calls `pickMultiRemoteTiles` directly. So the "3 remotes ordered by
focus" path is exercised today only via `pickMultiTiles`'s internal delegate
to `pickMultiRemoteTiles`, not by a separate call site.

## Files touched
- `mobile/src/live/stageStreams.test.mjs` (only file modified)

`mobile/src/live/stageStreams.ts` was **not** modified — no new export was
required; all new tests exercise the existing `pickStageStreams`,
`pickMultiTiles`, and `pickMultiRemoteTiles` exports.

## Verify commands run
```
node mobile/src/live/stageStreams.test.mjs
```
Output: `stageStreams.test.mjs: ok` (exit 0).

## Connect risk
none — test-only change, no production code touched, no CONNECTIVITY_LOCK /
offer / ICE / TURN / MediaSession paths touched.

COMPLETE
