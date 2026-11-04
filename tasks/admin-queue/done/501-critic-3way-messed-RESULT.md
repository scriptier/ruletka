# RESULT: 501-critic-3way-messed (second critic, read-only)

Status: COMPLETE — no defects found against the 6-point checklist. Read-only, no product files edited.

## Verify commands run
- `node --check ui/live.js` → exit 0
- `node --check ui/webrtc.js` → exit 0

## Check results (current on-disk state of the worktree)

1. **MATCHED 3-way does not keep `stage-trio-searching` / "Find 3rd" as middle column** — PASS.
   - `ui/live.js:12945` (`setThirdSlotStream`, live-stream branch) and `:11197` both explicitly `classList.remove("stage-trio-searching")` the moment a real stream lands on `#remote-third`.
   - `updateFriendActionButtons()` (`ui/live.js:14572-14583`) gates `canFindThird` on `!trioBrowse`; once a 3-way call is live, `#btn-find-third` is forced `hidden`.

2. **Empty `#tile-third` does not reserve a column; you not sliver** — PASS.
   - `ui/live-stage.css:2179-2190` (and duplicated breakpoint block at `:21162-21227`, `:21548-21571`) only switch to the 3-equal-column grid via `:has(#tile-third:not([hidden]) > #remote-third:not([hidden]))`. Empty/searching/hidden third always falls back to the 2-wide `partner | you` grid — comment at `:2179` cites this as a previously-fixed regression (`FAIL 071810Z`) and the guard is still intact.
   - `enableTrioLayout()` (`ui/live.js:12563-12662`) only marks the tile visible without hunt content when `thirdSlotHasLiveMedia()`/`peerPcs.size>=2` is already true at call time; all such call sites (`:11441`, `:13023`, `:14286`, `:29350`, `:29587`, `:29908`, etc.) are themselves guarded by the same live-media check before calling, so the CSS `:has()` gate and the JS state agree.

3. **Distinct stream per tile; `play()` remotes** — PASS.
   - `dedupeRemoteTileStreams()` (`ui/live.js:14044`) nulls out any tile whose `srcObject` duplicates one already seen.
   - `bindPcVideo()` (`:14067`) and `videoSlotsTrioBind()` (`:29973`) both check `streamOnAnyOtherTile()` before assigning and reroute to `pickFreeRemoteTile` instead of ever cloning a stream onto two `<video>` elements.
   - `playVideoEl()` (`:13921`) always calls `.play()`, with a muted-retry fallback on autoplay-policy rejection (comment: "one-way black on PC was often paused `<video>` with live tracks").

4. **`webrtc.js` pool=0** — PASS.
   - `ICE_CANDIDATE_POOL_SIZE = 0` (`ui/webrtc.js:17`) is the base for every branch in the ICE-config builder (`:515-572`); `hideOnly`/`forceRelay`/normal branches all resolve to `poolSize = 0` (the `directOnly` branch never reassigns it, but the default is already 0, so it stays 0 there too).

5. **`live.html` pins bumped if js/css changed** — PASS.
   - Uncommitted diff on `ui/live.html` bumps `webrtc.js?v=170→324`, `live.js?v=401→598`, `live-stage.css?v=359→414` (plus a new `live-brand.css?v=16` link), matching the size of the outstanding diffs in those files.

6. **No invented `product.ok`** — N/A / honored. This RESULT does not assert `product.ok` or `GOAL_MET`; only the two syntax checks above are asserted as run, with their literal exit codes.

## Files touched
None (read-only critic; only inspected `ui/live.js`, `ui/webrtc.js`, `ui/live.html`, `ui/live-stage.css`).

## Connect risk
none — no edits made.

## Note
No live black-screen or sliver repro was found by static review; the guards for both known failure modes (`FAIL 071810Z` sliver, black-tile autoplay) are present and internally consistent in the current on-disk (uncommitted) state. If 084504Z is a fresh device-observed repro rather than a static-review target, it likely needs a live phone+PC smoke (human/Grok gate) rather than further static critique — I did not attempt to reproduce interactively.

COMPLETE
