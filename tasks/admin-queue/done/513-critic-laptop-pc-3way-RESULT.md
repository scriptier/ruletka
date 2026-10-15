# 513 — critic: laptop 3-col vs PC 2-col (read-only)

Scope: read-only review of `ui/live.js` (party/trio-split) and `mobile/app/live.tsx`
(extras/startCall skip). No product files touched.

## Findings — all 6 checks PASS

1. **party + listed≥2 opens trio via `openTrioSplitForPeers`**
   `mustKeepTrioSplit(peers)` (`ui/live.js:12549`) returns true when `peerPcs.size >= 2`
   or `countListedRemotePeers(peers) >= 2`. Call sites gate on it before opening trio,
   e.g. `ui/live.js:28086-28088`: `if (mustKeepTrioSplit(peersIn) || peersIn.length >= 2) openTrioSplitForPeers(peersIn);`
   (also `ui/live.js:28130`, `28257`, `28543`, `28662`). `openTrioSplitForPeers`
   itself (`ui/live.js:12506`) also independently guards `n < 2 && peerPcs.size < 2 → return false`.

2. **3rd does not steal `#remote`**
   `ui/live.js:28089-28093`, comment + code: *"Pin live #remote (iPhone/teammate).
   New Android → #remote-third only."* — `bindPcVideo(occ, $("remote"))` keeps the
   existing live occupant on `#remote`; the new peer only ever binds to
   `#remote-third` (see `thirdSlotHasLiveMedia()` at `ui/live.js:12894`, which reads
   `$("remote-third")`, never `$("remote")`). Mobile mirrors this: `applyRemote2`/
   `applyRemote3` (`mobile/app/live.tsx:1781`, `1849`) write to separate
   `remoteStream2`/`remoteStream3` React state, never to the primary `remoteStream`.

3. **`live.tsx` extras≥1 skips primary startCall**
   `shouldSkipPrimaryStartCall` (`mobile/src/live/matchContinuity.ts:92-106`) returns
   `true` whenever `extrasCount > 0` (gated on `keepPrimary`, which is itself forced
   `true` when `thirdJoining = extras.length > 0`, `mobile/app/live.tsx:2618-2629`
   → `2624-2629` sets `keepPrimary = true` on `thirdJoining`). Net effect: a 3rd
   peer listed always suppresses primary `startCall` remount
   (`mobile/app/live.tsx:2661-2672` `skipEarly`, and the late-path
   `mobile/app/live.tsx:3820` `skipStart`). Comment at `matchContinuity.ts:88-90`
   states the contract explicitly: *"Never remount the first partner startCall
   when a 3rd is joining or we are in party_browse hunt."*

4. **No `pool>0` gate, no force_relay flip originating from trio logic**
   Grepped `ui/live.js` for `pool` — no gate of the form `pool > 0` conditions trio
   open/collapse; `pool` hits are unrelated (invite/lobby-hint copy only, e.g.
   `ui/live.js:15453-15484`). `force_relay` in the trio-adjacent block
   (`ui/live.js:28050-28054`) only *echoes* what the hub already sent
   (`if (msg.force_relay) setSessionForceRelay(true)`) — it is hub-driven, not a
   flip invented by the trio-split code path.

5. **Hidden `#remote-no-cam` is `display:none`**
   `ui/live.html:715`: `<div class="no-cam-portrait" id="remote-no-cam" hidden>`.
   `ui/live-stage.css:22393-22399`: `#tile-remote #remote-no-cam[hidden] { display:
   none !important; visibility: hidden !important; opacity: 0 !important;
   z-index: -1 !important; pointer-events: none !important; }`. Only unhidden
   (`display: flex`) once JS clears the `hidden` attribute
   (`ui/live-stage.css:22381-22391`, guarded by the "NEVER paint [hidden]" comment
   at `22376-22380`).

6. No fabricated pass/fail token used for this report; findings above are cited to
   file:line evidence only.

## OWN
RESULT only. No product files edited.
