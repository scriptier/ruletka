# 523 — Second critic: fast 1v1 → 30s 3-way picture (read-only)

**Status:** DONE (read-only review, no code touched)
**Scope:** `ui/live.js` trio-layout gate + connect-recovery timers, `ui/webrtc.js`
promote/watchdog guards. Read against `knowledge/specs/2026-08-15-fast-1v1-to-3way.md`,
`knowledge/wiki/now.md` (638/639 truth row), `knowledge/wiki/gotchas.md` #40/#52.
Code read from the **main tree** (`/home/drakosik/freenet-roulette`), which carries
the live 637–639 disk hops as uncommitted changes; the worktree does not have them
checked out. RESULT written to the worktree per task instructions.
**Files touched:** none (read-only).
**Verify commands run:** `node --check ui/live.js` · `node --check ui/webrtc.js` → both clean.

## Unneeded steps from the spec — status at disk 639

| # | Step (spec) | Status at 639 | Evidence |
|---|---|---|---|
| 1 | Hybrid rebuild @5.5s after a good first paint | **Guarded** | `startWebrtcWatch` hard timer returns immediately `if (!matched \|\| partnerVideoEverFrames \|\| partnerVideoHasFrames())` (`ui/live.js:11742-11749`), plus a second guard skips rebuild whenever `peerPcs.size<=1` and the first offer is already on the wire (`ui/live.js:11766-11790`, comment cites `005410Z`). |
| 2 | `setDirection`/second offer before first answer | **Guarded** | `_promoteVideoSend` defers (`_pendingPromoteSend`) instead of flipping direction when `_offerSentOnce && !_gotRemoteAnswerAt` (`ui/webrtc.js:1714-1721`); renegotiation offer only fires after `_gotRemoteAnswerAt` and `signalingState==="stable"` (`ui/webrtc.js:1741-1753`). |
| 3 | `setNoCamPortrait` after the partner already painted | **Guarded, both tiles** | `hookNoCamPortraitFromStream` short-circuits to `setNoCamPortrait(which,false)` whenever `tileHasPaintedPixels(which)` is true (`ui/live.js:2097-2101`), and `tileHasPaintedPixels` resolves `remote-third`/`remote2` via `noCamVideoElId`, not just `remote` (`ui/live.js:1964-1971`). The only direct `setNoCamPortrait("remote-third", …)` call site passes `false` (`ui/live.js:13915`) — nothing calls it `true` outside the guarded wrapper. |
| 4 | `638` `wantTrioColumns` requiring 2 live PCs — hides 3-col while 3rd is listed | **Fixed — this is the 639 hop** | `wantTrioColumns()` now returns true on `countListedRemotePeers()>=2` OR `countLiveRemotePeerPcs()>=2` OR `peerPcs.size>=2` (`ui/live.js:12821-12833`), not `peerPcs.size>=2` alone. `applyStageLayoutMode` only strips `stage-trio`/adds `stage-duo` when `!wantTrioColumns()` (`ui/live.js:12929-12952`, `12976-12979`) — so a listed-but-not-yet-live 3rd (the exact `010423Z`/638 case) no longer collapses to duo. |
| 5 | Full rematch / lobby spin on find-3rd | **Guarded** | `shouldSkipHuntLobbySpin()` blocks hub Spin while a PC is live during party/find-3rd (`ui/live.js:12869-12879`); `joinPeers` keeps any PC still in `list` or with live A/V instead of tearing it (`ui/live.js:31040-31083`). Gotcha **52**'s offer-watchdog promote is also still guarded off once `peerPcs.size>=2` or a frame ever landed (`ui/webrtc.js:2836-2877`, `hadOk \|\| multi \|\| hadFrame`). |

All five items the spec names are present and correctly guarded in the disk-639 source;
items 1/2/3/5 were already fixed in earlier hops (631–636) and remain intact — 639 only
had to change item 4.

## Is 639 enough?

**639's own change is correct and minimal** — it fixes exactly the 638 symptom quoted
in the task (stage collapsed to duo with `tile-third` still visible, `peerPcs=1`, a
listed-but-not-yet-connected 3rd). No further `live.js` layout edit is needed for that
specific bug.

**It is not sufficient by itself to guarantee the 2–3s feel**, and `now.md` already says
so ("no picture after paint… Feel ~30s still OPEN" — not yet re-confirmed by a human
smoke against 639). The layout no longer collapses, but layout correctness ≠ the 3rd
peer's video arriving fast. Two concrete, code-level gaps remain outside this hop's
scope:

1. **Hub per-client offer debounce (gotcha 40) is coded but not deployed.** The fix
   (`last_offer_at` keyed per target pair instead of per sender) is present in
   `bridge/src/simple.rs:216-218` and used at `:9328-9372`, but the gotcha log still
   tags it **"needs deploy"**. If the running hub predates that fix, a 1v2 first-join
   can still have its second (3rd-peer) offer dropped as thrash inside the 3.5s window
   — which reads on the client exactly as "3-col opens, mid tile stays empty/connecting
   for a long time," i.e. the residual ~30s. This is a deploy dependency, not something
   `live.js`/`webrtc.js` can route around, and is explicitly out of this task's scope
   (no ICE/TURN/hub edits).
2. **Real per-PC connect cost for the 3rd is not free.** Same-LAN mesh still forces
   relay (`CONNECTIVITY_LOCK`), so a 3rd participant is a 3rd TURN allocation
   (gotcha 39) on top of whatever the 1st pair already paid — allocation+permission RTT
   is inherent, not a bug to delete, but it means "3rd tile picture" will structurally
   lag "1st picture" by some seconds even with every client-side thrash removed.

**Recommendation:** re-run the human 1v1→3-way smoke against the current disk (639)
before assuming more `live.js` work is needed. If the mid tile still takes ~30s to show
a picture *after* it correctly opens as a 3rd column, the next diagnostic step is a
fresh CDP/hub score of the 3rd peer's offer→answer timing specifically (does the 2nd
offer leave the client promptly, does the hub answer it, or does it stall on the
debounce/TURN-allocation path) — not another `wantTrioColumns` layout change. Do not
invent PASS/MULTI_PASS from this code read; this is a source-level guard audit, not a
human smoke result.

## Connect risk
**none** — no `live.js`/`webrtc.js`/MediaSession/hub edits made; read-only review only.

COMPLETE
