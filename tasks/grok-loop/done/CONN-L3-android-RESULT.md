# CONN-L3-android — RESULT

## Status
**COMPLETE** (recommend only — **no MediaSession thrash**)

## Lane
CONNECT-ANDROID · match→answer speed + product one-way (phone frames)

## OWN
- READ: `mobile/src/media/MediaSession.ts`, `mobile/app/live.tsx`, specs/wiki
- WRITE: this RESULT (+ optional raw)
- **MUST NOT:** edit MediaSession / live.tsx · deploy · APK · pool · invent GOAL_MET

## Evidence (scorecard)

| Field | Latest `artifacts/av-verify/latest.json` |
|-------|------------------------------------------|
| stamp | **20260812T044852Z** (window 10m) |
| verdict | **WARN** |
| product.status | **one-way** · `done=false` |
| web fin/fout | **62634 / 62634** |
| android fin/fout | **0 / 0** |
| phone_to_pc / pc_to_phone | true / **false** (product gate: no android frames) |
| force_relay hub / web / android | true / true / **null** |
| android_policy · app_vc · bind_v | **null / null / null** |
| matches / offers / answers | 4 / 3 / **2** (answers lag) |
| max_mto / max_mta | 1999 / 3368 ms |
| last platforms | web ↔ android · last_force_relay=true |
| last_answer_relay_candidates | **0** |
| av_paths in sample | **web only** (interval ok=true, policy=relay) |

Contrast earlier same-day **product.ok**: L19e stamp `20260812T034413Z` — android fin/fout 254/26, **app_vc=375**, bind_v=1, policy=relay, hub_fr=1, fr_mismatch=false.

Hop9 residual (spec/wiki, product.ok session): max_mto=**1264** · max_mta=**2700** · serial~(mta−mto)≈**1436** · fr_mismatch hub pure vs android **policy=all** · app_vc then 367.

Disk APK pin: `mobile/app.json` **0.1.370 / versionCode 378**. Wiki smoke tip lags (0.1.363-vc371 / multi tip 0.1.366-vc374).

**GOAL_MET=no**

---

## Top 7 ranked recommendations

### 1. Detect missing android `av_path` vs true one-way (HIGHEST)

**Why now:** Latest product one-way is **not** proven Layer C encode death. Scorecard has **zero** android beacons (`app_vc=null`, `bind_v=null`, `force_relay_android=null`, `android_policy=null`). Web alone supplies all fin/fout. That is a different failure class from classic one-way (android present, fin high, fout=0, bind_v=1).

**Triage (hub journal / av-verify `av_path.by_platform`):**

| Observation | Diagnosis | Next layer |
|-------------|-----------|------------|
| No `platform=android` av_path in window | Phone not in scored pair, answer never emitted, or beacon wire dead | Match / answer emit / APK / hub signal |
| Android beacon, `bind_v=0`, ice=new | Answer/bind never completed | Layer B bind / answer path |
| Android `bind_v≥1`, `frames_out=0`, web `frames_in=0` | Classic PC-black one-way | Layer C encode (`enc_active`, GUM rebind) |
| Android `fr=1 hub_fr=1 policy=all` while web `policy=relay` | Pure path mismatch | Layer A force_relay PC rebuild |
| Android present, both fin/fout ≥ min_frames | True product.ok | Speed lane only |

**Code anchors:**
- Beacon emit: `MediaSession.reportAvPath` → `onSignal("av_path", …)` — ```3440:3657:mobile/src/media/MediaSession.ts```
- Arm waves: `armAvPathBeacons` — ```3660:3684:mobile/src/media/MediaSession.ts```
- Hub wire: `live.tsx` `onSignal` → `hub.signal(kind, payload, to)` — ```1159:1170:mobile/app/live.tsx```
- Inbound ignore: signal case skips apply for `av_path` — ```3287:3288:mobile/app/live.tsx```

**Do not** thrash encode/bind until an android beacon exists with `bind_v` / `frames_*`.

---

### 2. Answer serial wait cuts (only with `product.ok` gate)

**Why:** Hop9 residual serial answer ≈ **1436ms** (mta 2700 − mto 1264). Spec target mta **&lt;2500**. Latest window max_mta=**3368** (mixed pairs).

**Serial critical path today (inbound offer → answer emit):**

1. Optional hybrid force_relay poll **40ms** (hop9) — ```5004:5012:mobile/src/media/MediaSession.ts```
2. Cold cam/ICE prep race **≤150–200ms** — ```5031:5048:mobile/src/media/MediaSession.ts```
3. `setRemoteDescription` + **await** `bindAnswerOutbound` (MUST keep — product.ok) — ```5265:5281:mobile/src/media/MediaSession.ts```
4. `createAnswer` + `setLocalDescription`
5. Pure first-relay wait cap **`min(relayWaitBudgetMs, 280)`** hop9 — ```5368:5391:mobile/src/media/MediaSession.ts```
6. Emit answer + `reportAvPath("answer_sent")` — ```5420:5434:mobile/src/media/MediaSession.ts```

**Safe cut candidates (recommend only):**
- Early-exit when `answer_relay_already_in_sdp n>0` (already present) — ensure budget path never re-waits.
- Keep **pre-createAnswer** `await bindAnswerOutbound`; keep post-setLocal bind fire-and-forget (hop3+).
- Do **not** reintroduce hop10-style **150ms hard-cap** on pure relay (comment forbids — product regression).
- Hybrid poll already **80→40**; further only if offer-before-matched still shows in logs.
- Any pure budget cut **280→~220**: require before/after `av-verify product.ok` (spec CHECKPOINTS).

**MUST NOT:** pool&gt;0 · dual-offer · sticky wipe · GOAL_MET on mta alone.

---

### 3. `force_relay` policy=all → pure `relay` under hub pure

**Why:** Hop9 product.ok still WARNed **fr_mismatch**: hub=true · android fr=1 · **policy=all** vs web **policy=relay**. Layer A pure mismatch historically caused one-way (wiki `force-relay-same-lan`, `one-way-video` stage 1).

**Code reality:**
- `desiredRelayPolicy()` needs **hasTurn** + (hideIp \| forceRelayOnce \| hubForceRelaySticky) — ```1832:1838:mobile/src/media/MediaSession.ts```
- No TURN → pure intent fails open to **policy=all** in `pcConfig` — ```1728:1747:mobile/src/media/MediaSession.ts```
- `startCall` waits ICE up to 1200ms when force_relay but !hasTurn — ```2576:2589:mobile/src/media/MediaSession.ts```
- `ensureRelayPolicyPc` / signal_offer hard recreate if warm hybrid under pure — ```1779:1825:mobile/src/media/MediaSession.ts```, ```5070:5094:mobile/src/media/MediaSession.ts```
- `setForceRelay` defers rebuild mid-nego but pre-remote still calls ensure — ```1887:1912:mobile/src/media/MediaSession.ts```
- live.tsx latches hub force_relay **first** on matched — ```2124:2164:mobile/app/live.tsx```

**Recs (no thrash now):**
1. Smoke log must show `answer_prep … pure=1 policy=relay` and answer emit `policy=relay` (not all).
2. Prefer **search-time ICE prefetch** so answerer early kick never hits pure-without-TURN fail-open.
3. If beacon shows `hub_fr=1 force_relay=1 policy=all`, fix Layer A PC rebuild order — not coturn thrash while peer_hot.
4. Never clear sticky on `closeCall(keepLocal)` / startCall(false) races (gotcha #4).

---

### 4. Earliest answer kick from `live.tsx`

**Why:** mta includes match-handler UI lag before PC is ready for inbound offer.

**Already on disk (keep / verify on device APK):**
- Matched: latch force_relay → **EARLY** `startCall` before geo/UI storm — ```2254:2392:mobile/app/live.tsx```
- Answerer fast path: **no pre-startCall awaits**; background `fetchIceConfig` only — ```2289:2312:mobile/app/live.tsx```
- Offerer: no `waitWarmTurnPrimed` (pool=0 pure never primes) — ```2371:2372:mobile/app/live.tsx```
- `startPrimary("matched-immediate")` skips second startCall when early already fired — ```3234:3239:mobile/app/live.tsx```
- Multi secondary/tertiary parallel with primary — ```3150:3210:mobile/app/live.tsx``` area

**Residual recs:**
1. Confirm device build includes answerer-fast (app_vc ≥ hop9 answer APK; disk tip **vc378**).
2. Offer-before-matched: rely on MediaSession hop4 pure-SDP latch + live.tsx offer re-arm (```3433:3446:mobile/app/live.tsx``` region) — do not re-add long polls.
3. Do not block primary startCall on secondary settle (already parallel).
4. Log fingerprint: `startCall EARLY … answerer=1` then `startCall early ok +Nms (answerer-fast)` within hundreds of ms of match.

---

### 5. `av_path` beacon reliability (android)

**Why:** Without android beacons, product gate falsely reads as one-way / pc_to_phone=false even when media might be fine — or hides true no-match.

**Gaps vs web:**
- Web: one-shot waves **+ 8s interval** (`ui/webrtc.js` `_armAvPathBeacons`).
- Android: waves only **[2000, 5000, 8000, 12000]** — ```3664:3683:mobile/src/media/MediaSession.ts``` — **no interval** for long holds.
- Arm sites: `answer_sent`, ICE connected / ice state handlers — if answer never sent and ICE never connected, **zero** hub beacons.
- `reportAvPath` includes `app_vc`, `bind_v`, `hub_fr`, `policy`, fin/fout — ```3557:3578:mobile/src/media/MediaSession.ts```

**Recs:**
1. Prefer **interval beacon** parity with web once call gen active (recommend; implementer later).
2. Arm a **matched/startCall** early beacon (`why=matched` / `start_answerer`) even pre-answer so scorecard proves phone presence + app_vc.
3. Verify hub `signal(av_path)` not dropped (peer id empty only when legacy — still should log server-side).
4. Scorecard rule for agents: **app_vc=null ⇒ missing phone sample**, not automatic encode FAIL.

---

### 6. APK version / `app_vc` lag vs disk

| Source | Version |
|--------|---------|
| Disk `mobile/app.json` | **0.1.370 · versionCode 378** |
| L19e product.ok beacon | **app_vc=375** |
| Hop9 residual wiki | app_vc **367** then tip **371** |
| Latest one-way window | **app_vc=null** (no android beacon) |
| `ui/download/ANDROID-LATEST.txt` | stale **0.1.280** (do not install) |

**Recs:**
1. Human install APK built from current disk (**expect app_vc=378** in beacon).
2. After smoke, `av-verify` must show `product.app_vc` matching install; null means phone absent from window.
3. Align wiki/SMOKE-NEXT install lines with **0.1.370-vc378** when human ships (docs lane — not this thrash).
4. Do not claim hop9 answer serial cuts “on phone” until app_vc ≥ build that contains them.

---

### 7. Human smoke steps (verify-first)

1. **PC:** hard-refresh live so current `live.js?v=` + `webrtc.js?v=` load (linking-speed wiki pins; do not invent prod pins here).
2. **Phone:** install disk APK **0.1.370-vc378** (or newest artifact human authorizes) — not ANDROID-LATEST 0.1.280.
3. Same Wi‑Fi / same public IP path (expect hub `force_relay=true`).
4. One clean **Start** both sides; leave linked **≥20s** (no dual thrash / Next spam).
5. Run: `./scripts/av-verify.sh --min 10` (or 20).
6. **Pass bar for product:** `product.status=ok`, android fin/fout both ≥ min_frames, `app_vc` present, prefer `bind_v=1` + `policy=relay` when hub pure, `fr_mismatch=false`.
7. **Speed bar (secondary):** journal max_mto / max_mta vs hop9 residual **1264 / 2700**; stretch mta **&lt;2500**.
8. **If product still one-way:** apply rec #1 triage before any pure-wait cut.
9. **GOAL_MET=no** unless product.ok after that ship (spec gate).

---

## Ordered implementer queue (after this RESULT)

| Order | Lane | Focus | Gate |
|------:|------|--------|------|
| 1 | diagnose / smoke | Get android av_path + app_vc into window | product not null android |
| 2 | android-ui | Confirm early answerer kick on installed APK | log EARLY answerer-fast |
| 3 | android-answer | policy=all→relay under hub pure (Layer A) | beacon policy=relay |
| 4 | android-answer | serial pure cap only if product.ok holds | before/after product.ok |
| 5 | android-answer | av_path interval + early matched beacon | app_vc stable in window |
| — | turn-media | **skip** while peer_hot / max_rb HOT | — |

## MUST NOT
- Thrash `MediaSession.ts` in this hop (recommend only)
- pool&gt;0 · dual-offer · wipe force_relay sticky
- Deploy / APK build / invent **GOAL_MET**
- Treat web-only high fin/fout as phone product.ok

## Citations (primary)
- Spec: `knowledge/specs/current-linking-speed.md` hop9 android-answer + android-ui
- Wiki: `knowledge/wiki/linking-speed.md`, `one-way-video.md`, `force-relay-same-lan.md`, `gotchas.md`
- Scorecard: `artifacts/av-verify/latest.json` stamp **20260812T044852Z**
- Prior ok: `tasks/grok-loop/done/L19e-av-verify-RESULT.md` app_vc=375

## GOAL_MET
**no**
