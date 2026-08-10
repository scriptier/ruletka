# 128 — stageStreams unit edge

## Status
COMPLETE

## Files touched
- `mobile/src/live/stageStreams.test.mjs` — added 1 edge case block

## What changed
Added a test for `pickStageStreams` covering a matched call where the
primary `remoteStream` is missing but `remoteStream2` (an extra peer) is
present. Asserts `multiRemote` is true (driven by the second stream) while
`hasRemote`/`mainStream`/`waitingPeer` still fall back correctly (main
empty, local in PiP, waiting), since `hasRemote` only tracks the primary
remote stream. This combination wasn't previously exercised.

## Verify commands run
- `node src/live/stageStreams.test.mjs` → `stageStreams.test.mjs: ok`
- `bash scripts/dev-smoke.sh --unit` → `=== dev-smoke PASS (unit only) ===`

## Connect risk
none — test-only change, no production code touched.

COMPLETE
