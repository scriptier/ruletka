# CONN-L2-web-kick — RESULT

**Status:** COMPLETE (recommend-only)  
**Lane:** link-web-kick · PC web match→offer reliability + linking **feel**  
**Date:** 2026-08-12  
**OWN read:** `ui/live.js` (kickSolo / offerKick / handleMatched / paint-first), `ui/webrtc.js` (pure budget / warm first-pass / pool / force_relay)  
**Code change:** none (RESULT-only; no large diffs; no MediaSession)

## Residual anchors (do not invent GOAL_MET)

| Source | Metric | Value |
|--------|--------|-------|
| Wiki / hop9 product.ok smoke | max_mto | **1264** ms (target &lt;800 warm / &lt;1500 pure) |
| Wiki / hop9 product.ok smoke | max_mta | **2700** ms (target &lt;2500) |
| Wiki | product | **ok** that window |
| Live scorecard (context) | mto sample | **1426** ms (`first offer after match` web) |
| Live scorecard (context) | max_mto window | **1999** ms · answers&lt;offers WARN · android **missing** av_path · product **one-way** (not hop9 product.ok) |
| Disk pins | `ui/live.html` | **`live.js?v=568`** · **`webrtc.js?v=315`** |
| Spec belts | MUST NOT | pool&gt;0 · pure-wait cuts without product.ok gate · dual-offer thrash · invent GOAL_MET |

**Note:** Pure first-relay spend (webrtc hop9: cold **520** + second **350** ≈ **870** worst; warm first **350**) is mostly **web-relay** lane. Web-kick residual is overhead **before** setLocal, **recovery thrash** when budgets disagree, and **feel** after media is live.

## Disk path (current hop9 web-kick already on disk)

| Piece | Location | State |
|-------|----------|-------|
| Solo kick before joinPeers | `handleMatched` ~25453–25599 | fire-and-forget kick + denser offerKick |
| Cold TURN await | ~25512–25516 | race **280** ms only if force_relay && !hasTurnWarm |
| Pure warm no-block | ~25529–25557 | never waitIceWarmPrimed; warm async |
| offerKick waves (force_relay) | ~25593–25595 | `[0, 80, 180, 320, 480, 750, 1200, 2000, 3500, 4500]` |
| offerKick re-emit stuck local | `armOfferKickWatch` ~10306–10349 | real SDP only (`_offerEmitOk`) |
| inflightGrace | ~10296 | force_relay **700** / hybrid **400** |
| kickSolo free stuck mutex | ~26591–26612 | free if stuck ≥ **400** ms && !emitOk |
| kickSolo connect budget | ~27045–27049 | offerer **750** / answerer **1800** + emit-ok poll free |
| Cold GUM | ~26650–26675 | offerer race **280** ms |
| Paint-first frames toast | ~10811–10822 · `markPartnerVideoFramesSeen` ~14275 | Connected toast only after frames |
| Pure budget / warm first | `webrtc.js` `relayWaitBudgetMs` ~314–320 · offer wait ~2825–2852 | pure **520** · warm first **350** · second pure cold **350** · **pool=0** |
| rebuild-if-n=0 | offer path ~2864+ | stays (product.ok belt) |

---

## Top 7 ranked recommendations

### 1. Align offerer `connectBudgetMs` with pure worst-case first-relay wait

| Field | Detail |
|-------|--------|
| **title** | Raise pure/force_relay offerer connect budget so first path can finish emit before offerKick tear |
| **why** | Residual **mto 1264–1426** is mostly pure gather, but offerer `connectBudgetMs=750` &lt; pure worst **wait1+wait2 ≈ 520+350 = 870**. At **~750** ms, kickSolo frees locks / offerKick wave can **tear + re-kick** while first `_createAndSendOffer` is still mid-relay-wait → dual-offer / hub drop / worse p99 mto (historical 25s class when recovery stacked wrong). |
| **file:line / fn** | `ui/live.js` `kickSoloWebRtc` ~**27045–27049** (`connectBudgetMs = iOffer ? 750 : 1800`); interacts with `armOfferKickWatch` ~**10296** + force_relay waves ~**25593** |
| **expected mto / feel** | Reliability: kill thrash cases that spike mto; p99 **−100–400+** ms when thrash avoided. Median warm path largely unchanged. Feel: fewer “linking forever then sudden rebuild”. |
| **risk** | **Low–med** if scoped to `msg.force_relay` / pure only (hybrid can stay 750). Holding `_inflight` longer delays concurrent re-entry — offset by stuck-local **re-emit** (no tear) still working every wave. |
| **ship** | **hard-refresh only** (live.js) |

---

### 2. SDP-first offerer: do not await cold GUM before `connect()`

| Field | Detail |
|-------|--------|
| **title** | Parallelize cold GUM; emit empty-transceiver offer immediately when preview not live |
| **why** | Offerer still `await`s GUM race **280** ms when `previewStream` has no live video (`kickSoloWebRtc` ~26650–26676) **before** PC/createOffer. Path already supports no-cam offerer via addTransceiver + later `pushOutboundVideoTracks` (~2457–2468 webrtc, ~26713–26715 live). Cold-cam matches add non-relay mto on top of pure wait. |
| **file:line / fn** | `ui/live.js` `kickSoloWebRtc` ~**26644–26716** (GUM race + no-cam branch) |
| **expected mto / feel** | Cold cam mto **−0–280** ms. Warm preview (search already live) **0**. Feel: “match → offer” snappier on first open. |
| **risk** | **Low** if replaceTrack push remains after GUM resolves; brief outbound black until cam attaches (already acceptable “no-cam SDP” path). Do **not** skip GUM on answerer cold path without care. |
| **ship** | **hard-refresh only** |

---

### 3. Align offerKick pure `inflightGrace` with connect budget (no tear mid-first-relay)

| Field | Detail |
|-------|--------|
| **title** | force_relay inflightGrace ≥ pure first-path budget (or ≥ connectBudgetMs) |
| **why** | Today force_relay `inflightGrace=700` (`armOfferKickWatch` ~10293–10304). Waves **≥750** may re-kick/tear while `_offerInFlight && !localDescription` still legitimate (setLocal not done or mid-wait). Coupled with rec **#1**, this is the main **match→offer reliability** residual on web-kick (not pure budget cut). |
| **file:line / fn** | `ui/live.js` `armOfferKickWatch` ~**10293–10304**; re-kick tear ~**10357–10387** |
| **expected mto / feel** | Fewer second offers @~0.8s (hub debounce → black). Stabilizes mto under pure. Feel: less thrash flash. |
| **risk** | **Low** if grace only applies when `_offerInFlight && !local && !_offerEmitOk`. Stuck-local re-emit path must remain **ungated** by grace (already is). |
| **ship** | **hard-refresh only** |

---

### 4. Hard-refresh / deploy pin: measure on disk tip before more kick surgery

| Field | Detail |
|-------|--------|
| **title** | Require PC hard-refresh to **`live.js?v=568`** + **`webrtc.js?v=315`** before attributing residual to code gaps |
| **why** | Hop6–9 stuck-offer + denser kick + hop9 pure 520 live only if cache loads tip. Wiki smoke table still cites **v=559**; disk is **568**. Prior prod pin lag notes (VIP **561** vs disk) show agents invent “slow mto” on stale JS. Live sample **1426** may mix warm/cold + pin. |
| **file:line / fn** | `ui/live.html` ~**3031–3032** (preload ~397); wiki `knowledge/wiki/linking-speed.md` smoke steps |
| **expected mto / feel** | Unlocks already-shipped hop gains (often multi-second stuck-offer class when pin ancient). No new code. |
| **risk** | **None** (read/verify). Deploy is **human authorize** if CDN body lags pin string. |
| **ship** | **hard-refresh only** first; **hub/UI deploy** only if prod body sha ≠ disk (human) |

---

### 5. Paint-first feel: drop brand empty + arm frames on first video ontrack (not ICE)

| Field | Detail |
|-------|--------|
| **title** | Ensure ontrack → paintFirst + first-frame watcher before ICE “connected” |
| **why** | Residual is **feel** after media: hop9 correctly gates Connected toast on **frames** (`handleWebrtcConnectionState` ~10811–10822). ontrack path paints element + hides empty (~2370 webrtc) but **live.js** `paintFirstFromLiveTrack` / `armFirstFrameWatcher` are easier to miss if `onRemoteStream` races layout. Live track can sit under brand empty for 100–400 ms while strip still “Linking cameras…”. |
| **file:line / fn** | `ui/live.js` `paintFirstFromLiveTrack` ~**14349**; `paintRemoteFromPc` ~**12896**; `ensurePartnerVideoVisible` ~**12904**; webrtc ontrack paint ~**2301–2378**; `markPartnerVideoFramesSeen` ~**14215** |
| **expected mto / feel** | **mto 0** (signaling unchanged). Perceived linking end **−100–400** ms when RTP already HOT. |
| **risk** | **Low** if no null→srcObject thrash (existing same-stream guards). Do **not** toast Connected on track-only (keep frames gate). |
| **ship** | **hard-refresh only** |

---

### 6. Match kick: never `force:true` pure warm restart when same-policy ALLOCATE already in flight

| Field | Detail |
|-------|--------|
| **title** | Prefer promote/prime path; avoid killing in-flight pure warm at matched |
| **why** | handleMatched already avoids waiting on prime (~25540–25557). When `policy !== "relay"`, it calls `warmIcePool({ preferRelay: true, force: true })` — correct for hybrid→pure flip. When policy already `relay` but **not** primed, `force:false` keeps ALLOCATE (good). Residual risk: any later force clear mid-kick restarts ALLOCATE and pays full cold **520** again. Audit/call sites that `force: true` pure at match without policy check. |
| **file:line / fn** | `ui/live.js` handleMatched kick ~**25540–25557**; hangup rewarm ~**26225–26241** (hide_ip only — OK); `ui/webrtc.js` `warmIcePool` ~**684–736**, `takeWarmPc` pure never promote ~**842–848** |
| **expected mto / feel** | Warm pure mto closer to **&lt;800** when search primed; cold pure still gated by relay wait (web-relay). |
| **risk** | **Med** if force:false keeps dirty warm PC — pure path must stay **clean rebuild + pendingWarmRelayPrimed** (current design). Only avoid *extra* force restarts, not promote-safety close. |
| **ship** | **hard-refresh only** |

---

### 7. offerKick: re-emit-only early waves; defer PC tear until after pure budget window

| Field | Detail |
|-------|--------|
| **title** | Split offerKick actions: waves &lt; pureBudget+slop = re-emit / free mutex only; tear+rebuild only after budget |
| **why** | Today any wave past inflightGrace without emit can `closeCall` + `kickSoloWebRtc` (~10357–10387). Dense early waves are great for **stuck localDescription** re-emit, dangerous for **cold pure still gathering**. Explicit two-phase reduces dual-offer thrash while keeping hop6 25s MTO belt. |
| **file:line / fn** | `ui/live.js` `armOfferKickWatch` ~**10259–10393**; force_relay delay list ~**25593–25595** |
| **expected mto / feel** | Reliability on pure same-WiFi; fewer answers&lt;offers from glare. mto p50 small; p99 thrash cases large win. |
| **risk** | **Med** if tear deferred too long and first emit truly hung (set hang free + re-emit still active). Cap tear defer ~ pureBudget+second+slop (~950–1100), not multi-second. |
| **ship** | **hard-refresh only** |

---

## Explicitly NOT recommended in this hop (belts)

| Avoid | Why |
|-------|-----|
| pure `relayWaitBudgetMs` cut below **520** without product.ok | Spec gate; web-relay lane |
| warm first-pass below **350** without product.ok | Same |
| `iceCandidatePoolSize` / pool **&gt;0** | 437 / peer_usage≈0 history |
| wipe force_relay sticky | product black same-LAN |
| MediaSession edits | out of OWN |
| Invent GOAL_MET from residual table alone | need re-smoke product.ok after ship |

## Suggested implement order (if human greenlights code)

1. Rec **#4** verify pin (no code)  
2. Rec **#1** + **#3** together (budget/grace align — one small live.js patch)  
3. Rec **#2** SDP-first GUM (small live.js)  
4. Rec **#7** if thrash still in journal after 1+3  
5. Rec **#5** feel polish  
6. Rec **#6** only if logs show force warm restart at match  

## Smoke after any ship (no GOAL_MET invent)

1. PC hard-refresh → Network shows **`live.js?v=568`** (or post-patch bump) + **`webrtc.js?v=315`**  
2. Same-WiFi force_relay pure 1 match (no dual thrash)  
3. `./scripts/av-verify.sh` → **product.status=ok** + journal max mto/mta vs residual **1264 / 2700**  
4. Optional: client log `kickSolo connect +Nms … emit=1` and absence of `offerKick re-kick` in first 700 ms when emit eventually succeeds  

## Optional raw

`knowledge/raw/2026-08-12-connect-web-kick-recs.md` — same ranked list for wiki compound later.

## Completion

**COMPLETE** — recommend-only; no deploy; no GOAL_MET; no MediaSession; pool stays 0.
