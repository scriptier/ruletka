# 496 — Unit: stageStreams + matchContinuity still green after 3-way layout hops

## Status
COMPLETE — no code changes needed.

## Files touched
None. `stageStreams.test.mjs` and `matchContinuity.test.mjs` were reviewed but not
edited; existing coverage already asserts the two scenarios called out in the task:

- "2 remotes ⇒ split + pip you": `stageStreams.test.mjs:632-648` (`pickStageChromeLayout`
  with `remoteStream2` set, `remoteStream3` null) asserts `people===3`,
  `portraitColumn===true`, `wrapFirstPartner===true`, `pipYou===true`,
  `useGrid2x2===false`.
- "2×2 only at 4": `canShowGrid2x2` unit block at `stageStreams.test.mjs:705-723`
  asserts false for 1v1/3-way (incl. `remoteStream3` present but `extraPeerCount<2`)
  and true only at 4 people (`remoteStream3` + `extraPeerCount>=2`); the 4-people
  block at `stageStreams.test.mjs:664-703` cross-checks `useGrid2x2`/`portraitColumn`/
  `includeLocalTile`/`pipYou` toggling correctly between stacked and grid modes.

Confirmed the mirrored helpers (`pickStageChromeLayout`, `canShowGrid2x2`) in
`stageStreams.ts` match the test's local copies (read-only, unchanged).

## Verify commands run
- `node mobile/src/live/stageStreams.test.mjs` → `stageStreams.test.mjs: ok`
- `node mobile/src/live/matchContinuity.test.mjs` → `matchContinuity.test.mjs ok`

## Connect risk
none (no code touched, test-only review)

COMPLETE
