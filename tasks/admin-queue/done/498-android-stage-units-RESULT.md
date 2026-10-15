# 498 — Android stage split + hunt keep

## Status
COMPLETE

## What changed
Re-ran the existing unit coverage in `stageStreams.test.mjs` /
`matchContinuity.test.mjs` — both already encode the required contracts:
- 2 remotes → portrait split + PiP-you (`pickStageChromeLayout`, `people: 3`
  cases).
- 2×2 grid only unlocks at true 4-way (`remoteStream3` present **and**
  `extraPeerCount >= 2`) — never in 1v1 or 3-way (`canShowGrid2x2` tests).
- Hunt (`huntingThird`) wraps the 1v1 partner view instead of remounting it
  (`wrapFirstPartner`), and `multiRemote`/hub `extraPeerCount` alone never
  flip real multi layout.

Extended `stageStreams.test.mjs` with one new test locking the specific
"hunt keep" guarantee: `wrapFirstPartner` stays `true` continuously across
the hunting-alone → second-remote-lands transition (even as `huntingThird`
flips off exactly when `remoteStream2` arrives), so the wrapper key
LiveStageVideo derives from this flag never toggles false→true→false —
which is what would remount the primary `RTCView` and drop frames mid-hunt.

## Files touched
- `mobile/src/live/stageStreams.test.mjs` (new test only; no production code
  changed)

## Verify commands run
```
node src/live/stageStreams.test.mjs   # stageStreams.test.mjs: ok
node src/live/matchContinuity.test.mjs # matchContinuity.test.mjs ok
```
Both exit 0, all assertions pass.

## Connect risk
none — test-only change, no production code (`live.tsx`, `MediaSession`,
`live.js`) touched, no APK build.

COMPLETE
