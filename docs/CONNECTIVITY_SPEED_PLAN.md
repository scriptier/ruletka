# Connect speed + no-flicker plan (Play ↔ browser)

**Goal:** First match feels **instant** — one offer, one answer, partner video paints once without black stage or SurfaceView flicker.  
**Baseline:** 0.1.177 (works after wait / Next, but slow + flicker).  
**Shipped:**  
- **0.1.178** — Phase A + gather 500ms  
- **0.1.179** — B2 warm-PC reuse  
- **0.1.180** — D telemetry + search TURN pre-warm  
- **0.1.181** — Browser warmIcePool policy-aware; force_relay on mobile peer; Stop re-warms phone; CONNECTIVITY_LOCK refreshed  
- **0.1.182** — Cold-path: skip ICE wait when TURN prewarmed; kickSolo never blocks on warm config; soft/hard recover ≥10s/16s; paint-once ensurePartner  
- **0.1.183** — Kill Android dual-offer@6s/12s: no soft→hard-as-offerer escalate; answerer skip startCall after remote SDP; promote only after ≥8s silence  
- **0.1.184** — Background resume no longer promotes offerer; soft ICE only  
- **0.1.185** — Speed: gather wait 150ms; answer GUM 280ms; skip ICE HTTP when warm; hard rebuild ≥22s (no thrash@16s)  
- **0.1.186** — Pure trickle (0 gather wait); never hard-as-offerer after answer; keyframe burst; hub answerer grace 30s  
- **0.1.187** — Promote queue warm PC (TURN pre-alloc); UDP TURN first; pool=4/6; no clearIceWarm before kick  
- **0.1.188** — Dev tooling: CONNECT stopwatch toast; `smoke-connect.sh`; `UI_ONLY=1` push  
- **0.1.189** — Keep warm PC on force_relay; low-bitrate first path; keyframe on ICE checking  
- **HUMAN PASS 2026-08-09** — Play↔browser cameras linked **fast** (user-confirmed); lock baseline; no thrash on hub  
- **0.1.190** — 2nd match speed: don't clear force_relay on hangup; immediate re-warm after closeCall  
- **0.1.192** — Keep warm PC on answer offer; faster GUM; no always-rebuild on force_relay signal  
- **0.1.194** — Answer emit before codec/quality; parallel warm GUM+PC; tighter offerKick  
- **0.1.195** — Answer emit before setLocal (MTA); offer still setLocal-first (safe); offerKick re-emit stuck local SDP (kill 35s MTO); faster frame harvest/watch; match warm preferRelay  
- **0.1.196** — Android soft privacy veil (hide clear RTCView); web canvas blur harden  
- **0.1.199** — force_relay first-relay in SDP (~700ms); stuck-ICE restart 3.5s/8s; hub first-ice log  
- **0.1.200** — Real TURN ALLOCATE pre-warm (createOffer+rollback during search); stuck-ICE 2.5s/6s; pool=8; denser keyframes  
- **0.1.201** — Match kick waits for warm prime; skip long first-relay wait when primed  
- **0.1.202** — Mobile waitWarmTurnPrimed on force_relay; hangup rewarm does full TURN prime; hub-match-speed MTI  
- **0.1.203** — Black recovery: earlyBlack ICE restart (2s/4s/7.5s) actually runs (was blocked by 14–18s grace); keep black_watch after ICE connected; first-relay budget keys on warmTurnPrimed not mere PC warm  
- **0.1.204** — Offerer iceRestart earlyBlack unblocked (was 8.5–20s createOffer grace); hold low bitrate until first frame; longer match wait for TURN prime (1.1–1.2s)  
- **0.1.205** — Hub offer debounce 8s→3.5s so earlyBlack iceRestart offers land (was silently dropped); black_watch renego @3.8s/7s  
- **0.1.206** — TURN for RN: strip `?transport=udp`, one IceServer per URL (fix peer_usage=0 / no phone ALLOCATE); answerer never re-offers; first-relay extend if n=0  
- **0.1.207** — force_relay no longer sets iceTransportPolicy=relay (was killing same-WiFi host path; coturn peer_usage=0); relay-only only for Hide IP  
- **0.1.208** — force_relay waits for first TURN in SDP again (keep host); 207 skipped wait → host-only SDP on guest WiFi; answerer latch earlier; hub logs relay_candidates  
- **0.1.209** — Proven fix: web offer had relay_candidates=0; re-arm iceTransportPolicy=relay for force_relay; hard wait for typ relay (no warm short-circuit); both sides must have relay  
- **0.1.210** — Block emit if still 0 relay; rebuild relay PC once; re-arm force_relay in kickSolo; live build badge; admin-connect.html monitor  
- **Tooling** — `./scripts/dev-smoke.sh` · `./scripts/connect-monitor.sh` · `/admin-connect.html`













**Constraint:** Keep CONNECTIVITY_LOCK rules (P2P, one offer/match, no dual-offer thrash).

---

## What “slow + flicker” is made of

```
Search          Match              ICE/TURN           First frame
  │               │                   │                    │
  ├─ cam warm     ├─ force_relay?     ├─ gather relay      ├─ ontrack
  ├─ ICE fetch    ├─ startCall        ├─ allocate TURN     ├─ RTCView bind
  └─ warm PC?     ├─ offer/answer     └─ connected         └─ remount spam ← FLICKER
                  └─ promote/retry ← THRASH ← SLOW
```

| Symptom | Root cause (proven in logs / screenshots) |
|---------|-------------------------------------------|
| Slow first connect | TURN not pre-warmed; `waitForIceGatherRelay` + late `startCall`; answerer promote race |
| Works on 2nd/Nth Next | First path torn down by soft/hard recover or second offer (~6s) |
| Flicker | Multi-wave `repaintRemoteStream` + `streamEpoch` remounts + PiP delay mount |
| Black then video | Tracks present before frames; RTCView remounts mid-decode |
| Dual offer @ ~6s | Phone promote / auto-retry / watchdog (fixed partly in 0.1.177) |

**Speed targets (product)**

| Step | Target | Stretch |
|------|--------|---------|
| Match → first offer | &lt; 400 ms (warm) | &lt; 250 ms |
| Offer → answer | &lt; 500 ms | &lt; 300 ms |
| Answer → partner paint (TURN) | &lt; 2.5 s | &lt; 1.5 s |
| Match → both cams usable | **&lt; 3 s** | **&lt; 2 s** |
| SurfaceView remounts after first paint | **0** | 0 |

---

## Principles (non‑negotiable)

1. **One offer per match** until ≥12 s with *no frames* (not “no track”).
2. **Web is preferred offerer** — phone never promotes before ~4 s silence.
3. **Pre-warm on search**, not on match: cam + ICE config + TURN allocate + optional warm PC.
4. **Paint once:** bind remote RTCView once when first frame arrives; no timed epoch spam.
5. **Flicker = bug:** any remount after `framesDecoded > 0` needs a reason logged.
6. **Measure every step** (match→offer, offer→answer, answer→frames, frames→paint).

---

## Phase A — Kill flicker (UI / SurfaceView) — 1 day

*Highest UX win, lowest connect risk.*

| # | Change | Detail |
|---|--------|--------|
| A1 | **Single remote RTCView lifecycle** | Mount partner `VideoView` once per `remoteStream` URL; do **not** bump `streamEpoch` on a timer. Only bump on new stream URL or track-id change. |
| A2 | **Remove dense repaint waves** | Collapse `ontrack` / `ice_connected` / `pc_connected` multi-timeouts to: 1 immediate + 1 at 300 ms **if** `!framesSeen`. Stop all remounts after first frame. |
| A3 | **Stable PiP** | Keep local PiP mounted from search→match (same RTCView instance). Drop 700 ms hide/show PiP (that is visible flicker). |
| A4 | **zOrder freeze** | Partner `zOrder=1`, local PiP `zOrder=1` (or 0/1 only if parents stay fully transparent). Never change zOrder mid-call. |
| A5 | **Connecting UI** | Empty main shows “Linking…” card only until first remote frame; no black full-stage without copy. |

**Success:** When video appears, it does not flash black/self/partner repeatedly.

---

## Phase B — Instant first path (media) — 1–2 days

| # | Change | Detail |
|---|--------|--------|
| B1 | **Search pre-warm (hard)** | On Start/search: (1) `fetchIceConfig`, (2) `ensureLocalStream`, (3) warm `RTCPeerConnection` with TURN listed, (4) optional early TURN allocate via short-lived datachannel-less PC or `iceCandidatePoolSize` gather. |
| B2 | **Match = attach only** | On `matched`: reuse warm PC if policy matches `force_relay`; only rebuild if iceTransportPolicy must flip (all→relay). |
| B3 | **TURN gather budget** | `waitForIceGatherRelayOrDone` cap **400–500 ms** (not 900). First relay candidate is enough; rest trickle. |
| B4 | **Answerer silence** | Phone stays answerer **≥3.5 s**; if web offer arrives, never promote. Watchdog only if *zero* SDP either way. |
| B5 | **Keyframe once** | On ICE connected: one outbound keyframe burst (0 + 200 ms). No 5-step remount ladder. |
| B6 | **Browser parity** | Same: kickSolo with warm ICE, no Prefer-Direct on force_relay, push tracks once at connect, keyframe once. |

**Success:** Hub log `match_to_offer_ms < 400` and **exactly one** offer + one answer for the match.

---

## Phase C — Smart recover (only if first path fails) — 0.5 day

| # | Change | Detail |
|---|--------|--------|
| C1 | **Frames, not tracks** | Auto soft/hard only if `inbound-rtp framesDecoded === 0` (already partially done). |
| C2 | **Timings** | Soft ICE restart **≥12 s**; hard rebuild **≥18 s**. Never soft at &lt;10 s. |
| C3 | **Soft = ICE only** | No `forceRelayRebuild`, no promote-to-offerer on soft. |
| C4 | **Hard = user-visible** | One toast “Reconnecting path…” so flicker isn’t silent thrash. |
| C5 | **Next = clean slate** | Next clears offer locks, warm PC, frames flags (already mostly true). |

---

## Phase D — Instrumentation + regression gate — 0.5 day

| # | Change | Detail |
|---|--------|--------|
| D1 | **Client phases** | Log/telemetry: `match`, `offer_out`, `answer_in`, `ice_connected`, `first_frame`, `first_paint`. |
| D2 | **Hub** | Keep `match_to_offer_ms`; add optional `answer_ms` if easy. |
| D3 | **Smoke script** | `./scripts/hub-match-speed.sh` + device checklist: 5× Start once, no Next; fail if any dual-offer or connect &gt; 5 s. |
| D4 | **CONNECTIVITY_LOCK update** | Document force_relay for web↔android + “one paint” rule; freeze thrash anti-patterns. |

---

## Explicit non-goals (this sprint)

- SFU / LiveKit  
- Always-on force_relay for *every* match type  
- Sub-second global RTT (physics/TURN limits)  
- Perfect LAN host without TURN when same public IP (hairpin)  

---

## Implementation order (recommended)

```
Day 1  A1–A5  flicker gone, even if still ~3–4 s to picture
Day 2  B1–B4  pre-warm + reuse PC + gather cap → match feels instant
Day 2  B5–B6  keyframes + browser parity
Day 3  C1–C5  recover only when truly dead
Day 3  D1–D4  measure + lock
```

Ship APKs: **0.1.178** (A), **0.1.179** (B), **0.1.180** (C+D) — smoke after each.

---

## Smoke checklist (each ship)

1. Install APK; hard-refresh browser once.  
2. Both Start **once**; wait 15 s; **no Next**.  
3. Hub: `force_relay=true` for web↔android, **1 offer + 1 answer**.  
4. Phone: partner full stage, self PiP, **no black flash after first picture**.  
5. Timer to both cams: aim **&lt; 3 s**.  
6. Stop → Start again: still fast (warm path).  
7. Next once: clean rematch, still one offer.

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Pre-warm PC wrong policy (all vs relay) | Rebuild only on force_relay flip |
| Fewer remounts → rare black stuck | One late repaint at 2 s if frames=0 only |
| Longer promote → silent web | offerKick at 2 s / 3.5 s web-side (already) |
| TURN cold allocate still ~1 s | Pre-allocate during search (B1) |

---

## Decision needed before coding

1. **Ship A alone first?** (recommended: flicker fix even before speed)  
2. Accept **TURN always for Play↔browser** as permanent (yes for reliability)?  
3. Stretch target **&lt; 2 s** or ship **&lt; 3 s** first?

---

*Author: post-0.1.177 session. Related: `CONNECTIVITY_LOCK.md`, `DEVICE_SMOKE.md`.*

---

## 2026-08-11 — match→offer latency budget (real hub evidence, task 006)

`./scripts/hub-match-speed.sh 720 2000` against prod (`journalctl -u
roulette-bridge`, read-only) over a 12h window, 69 matches / 58 offers:

| metric | value |
|---|---|
| slow offers (&gt;2000ms) | 19 / 58 |
| max `match_to_offer_ms` | 26176 |
| android SLOW first-offers | 0 (android is never the slow offerer — web is) |

`match_to_offer_ms` for **web** offerers (the always-preferred offerer, see
CONNECTIVITY_LOCK "Client rules" #1) is **trimodal**, not evenly spread:

| cluster | samples (ms) | share |
|---|---|---|
| healthy | 200–2369 (most under 1000) | ~34/58, meets &lt;2000 target |
| mid-stall | 8549, 8550, 8562, 8584, 8592, 9109, 9415 | 7/58 |
| hard-stall | 25533, 25547, 25561, 25568, 25570, 25592, 25618, 26176 | 8/58 |

The two stall clusters are each tight (mid-stall spans 866ms, hard-stall
spans 643ms across 8 samples) — this is a deterministic recovery-timer
tail firing, not network jitter.

**Root cause (code reading, `ui/live.js` / `ui/webrtc.js`):** the offerer's
first-offer recovery ladder (`armOfferKickWatch`, `ui/live.js:9515`) re-kicks
a stuck `kickSolo` at fixed delays and, on its **last** wave, tears down and
calls `kickSoloWebRtc()` fresh. Before this task the call-site ladder ended
at 2500ms (normal) / 4000ms (`force_relay`). The rebuild itself (cam +
`createOffer` + `setLocalDescription` + relay-candidate wait + emit) can
itself take several seconds under load — roughly matching the mid-stall
cluster (last wave + a multi-second rebuild ≈ 8.5–9.4s). When *that* rebuild
also stalls, there was **no further wave scheduled** — the ladder just
stops — so recovery had to wait on some other/later mechanism, landing in
the ~25.5s hard-stall cluster.

### Fix landed (small, safe — this task)

`ui/live.js` (`armOfferKickWatch` call site, ~line 23636): extended the
retry ladder's tail with two more waves, still ≥3s apart (hub debounce is
~3.5s) and still gated by the same `hasRealSdp()` / `hasLiveRemoteMedia()`
guards that make every wave a no-op once a real offer is on the wire:

- normal: `[400, 1200, 2500, 6000, 9500]`
- `force_relay`: `[800, 2000, 4000, 8000, 12000]`

This does not change hub `force_relay` policy, debounce, answerer behavior,
or add a new offer path — it only gives the existing self-healing rebuild
another chance or two before the current ~25s tail. Expected effect: the
hard-stall cluster should mostly collapse into the ~9.5–13s range (one more
rebuild cycle) instead of ~25s+; does not by itself fix the *rebuild taking
several seconds* problem (see checklist).

### Checklist / follow-up (needs live Play↔PC smoke — do not do unsupervised)

1. Re-run `./scripts/hub-match-speed.sh 60 2000` after this change ships;
   confirm no new `answerer first-path grace` drops or double-offer thrash
   (`offer drops` count must not increase).
2. Investigate why the **rebuild itself** (not just the wait-to-retry) takes
   several seconds: instrument `_createAndSendOffer` (createOffer /
   setLocalDescription / relay-wait / emit, `ui/webrtc.js`) with per-phase
   timestamps for one full session to see which phase dominates — prime
   suspect is TURN relay-candidate gathering (`waitForIceGatherRelayOrDone`)
   under cold/loaded coturn, since offer `payload_len` in the hub log is
   consistently ~7500 bytes (candidates already included — i.e. the offer is
   never trickled, so slow gathering directly inflates `match_to_offer_ms`).
3. If (2) confirms gathering is the dominant cost, the correct fix is
   probably switching first-offer emit to **trickle ICE** (emit the offer as
   soon as `setLocalDescription` resolves, send candidates as separate signal
   messages) instead of waiting on `waitForIceGatherRelayOrDone` at all —
   that is a bigger, riskier change than this task's scope and needs its own
   phone+PC smoke pass before merge.
4. Target stays `match_to_offer_ms < 2000` per CONNECTIVITY_LOCK; current
   healthy-path median is already well inside that — the trimodal stall tail
   is the whole gap.
