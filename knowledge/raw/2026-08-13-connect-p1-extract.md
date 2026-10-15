# Raw: P1 extract map (MediaSession) — 2026-08-13

**Lane:** p1-inventory · herd `20260814T020528Z`  
**Source:** read-only `mobile/src/media/MediaSession.ts` (5874 lines) + `docs/CONNECTIVITY_LOCK.md`  
**Intent:** document a later extract. **Do not split MediaSession this hop.** No product code. No product.ok claim.

Existing unit already mirrors one pure helper: `mobile/src/media/offerSdpLooksPureRelay.test.mjs`.

Dest files follow repo camelCase under `mobile/src/media/`. Spec module names stay PascalCase.

---

## Lock constraints (must survive any later extract)

From `docs/CONNECTIVITY_LOCK.md` + spec critical paths:

- `iceCandidatePoolSize = 0` forever (`pcConfig` ~1745).
- Hub `force_relay` / hide_ip → `iceTransportPolicy=relay` + strip host/srflx (UDP TURN only).
- Normal match (different public IPs) → `force_relay=false`, `policy=all`, keep private host.
- **Arm sticky only on true.** Never `startCall(forceRelay:false)` / soft-retry wipe mid-call.
- Clear sticky on hangup / Next only. **`closeCall({ keepLocal: true })` must retain** `hubForceRelaySticky`.
- Answerer: no `addTrack` before `setRemote(offer)` — `replaceTrack` only (`bindAnswerOutbound`).
- Await `bindAnswerOutbound` once **before** `createAnswer`. Post-answer waves `[200, 600, 1500, 3000]`.
- Hop11 answer first-relay: **warm 180 / cold 220**. Never a global cap **&lt;180**.
- Offerer first-relay cap 400 (fail-open if n=0).
- No dual MediaSession writers. No pool&gt;0. No implement extract this hop.

---

## Dest files (suggested)

| Spec module | Suggested dest | What moves |
|-------------|----------------|------------|
| **IceSdpUtils** | `mobile/src/media/iceSdpUtils.ts` | Pure SDP / ICE-URL / candidate string helpers (~153–401). |
| **ForceRelayPolicy** | `mobile/src/media/forceRelayPolicy.ts` | Pure predicates + **one latch helper**. Rebuild/PC stay in MediaSession. |
| **BindOutbound** | `mobile/src/media/bindOutbound.ts` | `trackUsable` (pure) first; bind/watch stay this-bound (or take a ctx). |
| **RelayWaitBudgets** | `mobile/src/media/relayWaitBudgets.ts` | Wait primitive + hop caps as **named constants** (values unchanged). |

MediaSession keeps the class spine: `ensurePc` / `startCall` / signal offer-answer / `closeCall`.

---

## IceSdpUtils — `mobile/src/media/iceSdpUtils.ts`

Module-level functions already **pure** (no `this`). Best first extract. Keep signatures identical.

| Symbol | ~line | Binding | Risk | Notes |
|--------|------:|---------|------|-------|
| `normalizeIceUrl` | 153 | **pure** | **move-only** | Strip `?transport=udp` (RN ALLOCATE). |
| `expandIceServers` | 170 | **pure** | **move-only** | One URL per object; STUN fallback. |
| `filterIce` | 190 | **pure** | **move-only** | mode `all` / `turn` / `stun`. |
| `preferTcpTurnFirst` | 209 | **pure** | **move-only** | Name is historical — **UDP TURN first**, then TCP, then TURNS. |
| `serializeIceCandidate` | 226 | **pure** | **move-only** | Do not invent `sdpMLineIndex=0`. |
| `isMdnsHostIceCandidate` | 245 | **pure** | **move-only** | `*.local` + `typ host`. |
| `stripMdnsHostCandidatesFromSdp` | 258 | **pure** | **move-only** | `console.info` side effect — keep. |
| `isRelayIceCandidate` | 284 | **pure** | **move-only** | RN `type` / `candidateType` + SDP `typ relay`. |
| `udpTurnOnly` | 307 | **pure** | **move-only** | Drop TCP + `turns:`. Empty → return original (fail-open). |
| `forceVideoSendrecvSdp` | 324 | **pure** | **move-only** | Phone answer recvonly → PC black. Used ~5332, ~5438. |
| `offerSdpLooksPureRelay` | 367 | **pure** | **move-only** | Hop4 latch. **Retarget** `offerSdpLooksPureRelay.test.mjs` to import real export (today it copies the fn). |
| `stripNonRelayCandidatesFromSdp` | 382 | **pure** | **move-only** | No-op if `relayN===0` (never empty SDP). |
| `stripHostCandidatesFromSdp` | — | **pure (new)** | **move-only** | **Not a function today.** Inline 4-line filter duplicated ~4119–4126, ~5166–5175, ~5444–5451. Extract only if byte-identical. |

**Leave in MediaSession (uses IceSdpUtils, not dest):** trickle filter in ICE handler ~4961–4969 (`shouldFilterToRelayCandidates` + `isRelayIceCandidate` + `isMdnsHostIceCandidate`).

**Do not put here:** `waitForIceGatherRelayOrDone` — that is RelayWaitBudgets (wait primitive).

---

## ForceRelayPolicy — `mobile/src/media/forceRelayPolicy.ts`

### Predicates (extractable as pure given a snapshot)

Snapshot shape (suggested, not implemented):

```text
{ hasTurn, hideIp, forceRelayOnce, hubForceRelaySticky }
```

| Symbol | ~line | Binding now | Risk | Notes |
|--------|------:|-------------|------|-------|
| `desiredRelayPolicy` | 1840 | **this** | **move-only** if snapshot in | `hasTurn && (hideIp \|\| forceRelayOnce \|\| hubForceRelaySticky)`. Same-LAN / no TURN → false. |
| `shouldStripHostCandidates` | 1852 | **this** | **move-only** if snapshot in | Flags only — **no** `hasTurn` gate (unlike desired). |
| `shouldFilterToRelayCandidates` | 3944 | **this** | **move-only** | Alias of `desiredRelayPolicy()`. |
| `shouldWaitForFirstRelay` | 3953 | **this** | **move-only** | Also alias of `desiredRelayPolicy()`. Dest: RelayWaitBudgets *or* re-export from policy. |
| `isForceRelay` | 1861 | **this** | **move-only** | `forceRelayOnce \|\| hubForceRelaySticky` (no hideIp). Public. |

### Single latch helper (P1 named item — **behavior** if unified)

Today **five write sites** mutate the same two flags. Spec P1 wants **one** helper.

| Call site | ~line | Binding | What it does today | Unify risk |
|-----------|------:|---------|--------------------|------------|
| `setForceRelay(on)` | 1865 | **this** | Latch flags first; arm sticky on true; explicit false clears sticky; may rebuild PC unless mid-negotiate; hop9 pre-remote `ensureRelayPolicyPc`. | Canonical. |
| `startCall` arm-only | 2440–2453 | **this** | `forceRelay===true` → `setForceRelay(true)` (catch: set both flags). `false` is **no-op** if already clear. **Never clear on false.** | Must stay arm-only. |
| `warmConnection` | 2336–2338 | **this** | `preferRelay && hasTurn` writes **both flags directly** (bypasses `setForceRelay`). | **behavior** if routed through helper (rebuild/defer vs silent latch). |
| `forceRelayRebuild` | 1962–1963 | **this** | Sets both flags then **closes PC**, clears remote/chat. Used for hairpin stall. | **behavior** — not a flag-only latch. |
| `closeCall` clear | 5769–5772 | **this** | `clearForceRelay ?? !keepLocal`. keepLocal **retains** sticky. hideIp skip. | **behavior** if helper also rebuilds. |
| inbound offer SDP | 5002–5003 | **this** | `offerSdpLooksPureRelay(sdp)` → `setForceRelay(true)`. | Already uses setter. |

**Suggested helper (later, not this hop):**

```text
latchForceRelay(flags, next: boolean, mode: 'arm' | 'clear' | 'keepLocal')
```

- `arm`: next=true only; sticky=true. Never interpret false as clear.
- `clear`: hangup/Next. Both flags false (unless hideIp).
- `keepLocal`: no flag change.

PC rebuild stays in `setForceRelay` / `ensureRelayPolicyPc` / `forceRelayRebuild` **inside MediaSession**. Helper is flags only.

### Stay in MediaSession (this-bound, **behavior** if moved as-is)

| Symbol | ~line | Binding | Risk | Why stay |
|--------|------:|---------|------|----------|
| `forceRelayOnce` field | 473 | **this** | — | Call-scoped latch. |
| `hubForceRelaySticky` field | 479 | **this** | — | Survives keepLocal rebuild. |
| `pcUsesRelayPolicy` field | 562 | **this** | — | Warm reuse gate. |
| `pcConfig` | 1731 | **this** | **behavior** | pool=0; fail-open no TURN → `policy=all`; `udpTurnOnly` + slice(0,1). Lock surface. |
| `ensureRelayPolicyPc` | 1787 | **this** | **behavior** | Rebuild gates: no remote SDP / no mid-create; wrong-policy allowed while offerPending. Orphan bind if torn mid-answer. |
| `setForceRelay` | 1865 | **this** | **behavior** | Latch + optional rebuild. Mid-negotiate defer. |
| `forceRelayRebuild` | 1957 | **this** | **behavior** | Closes PC; **keeps** `answeredAsAnswerer` / `offerSentThisCall` (no re-offer). |
| `startCall` latch block | 2435–2453 | **this** | **behavior** | Arm-only-on-true. |
| offer hybrid poll | 5012–5045 | **this** | **behavior** | 40 ms fail-open (hop9). Pure SDP already latched. |

---

## BindOutbound — `mobile/src/media/bindOutbound.ts`

### First slice (safe)

| Symbol | ~line | Binding | Risk | Notes |
|--------|------:|---------|------|-------|
| `trackUsable` | 3072 | **pure** (no `this`) | **move-only** | Ended → false; missing readyState still usable. |

### Core bind (this-bound — later / high coupling)

| Symbol | ~line | Binding | Risk | Notes |
|--------|------:|---------|------|-------|
| `remoteOfferMLineKinds` | 3048 | **this** (reads `pc.remoteDescription`) | **move-only** if SDP string in | Audio/video m-line order. |
| `armVideoSenderEncode` | 3086 | **this** (`qualityTier`) | **behavior** if encodings change | `applySenderEncoding` + keyframe. |
| `bindAnswerOutbound` | 3139–3419 | **this** | **behavior** | replaceTrack only. Await **once** before `createAnswer` (~5290). Returns `vSend>0`. Sets `lastBindVideoSenders`. |
| `attachLocalTracksIfNeeded` | 2881 | **this** | **stay** | Answerer path never `addTrack`. Not the P1 dest core. |
| `attachLocalTracksFireAndForget` | 3422 | **this** | P0 dead | **ms-safe OWN** this herd hop — do not extract. |
| `lastBindVideoSenders` field | 481 | **this** | — | av_path `bind_v`. |

### Outbound watch + post-answer waves (P1 “clear timers on closeCall”)

| Symbol | ~line | Binding | Risk | Notes |
|--------|------:|---------|------|-------|
| `scheduleOutboundVideoWatch` | 3432 | **this** | **behavior** | Waves `[600, 1200, 2000, 3500, 6000, 10000]`. **`setTimeout` IDs not stored.** |
| `pollOutboundVideo` | 3709 | **this** | **behavior** | Re-bind + encode check. |
| `_outboundWatchArmed` | 3444 | **this** | — | closeCall only flips false — **does not cancel** in-flight timeouts. |
| `_outboundFramesSeen` | 3445 | **this** | — | |
| post-answer bind waves | 5488–5500 | **this** (inline) | **behavior** | `[200, 600, 1500, 3000]` — also **unstored** `setTimeout`. Spec critical path. |

**P1 item “clear outbound timers on closeCall”:** store both wave lists on the instance and `clearTimeout` in `closeCall` (alongside `_avPathTimers` ~5717). **ms-safe lane owns this hop** (`store+clear outbound watch timers`). Inventory only here — do not implement in this lane.

Call sites that must keep **await-before-createAnswer** (~5290) and fire-and-forget after (~5370, ~5473, ~5491). Changing that serial is **P2 / product.ok smoke**, not P1.

---

## RelayWaitBudgets — `mobile/src/media/relayWaitBudgets.ts`

Extract **numbers as named constants**. Do **not** change values (that is P2).

| Symbol / constant | ~line | Binding | Risk | Locked value |
|-------------------|------:|---------|------|--------------|
| `waitForIceGatherRelayOrDone` | 404–466 | **pure** (pc + maxMs) | **move-only** (keep handler wrap order) | Default `maxMs=150`. Early-exit on first typ relay or gather complete. **No 250 ms floor.** Wraps existing `onicecandidate`. |
| `relayWaitBudgetMs` | 3957 | **this** | **move-only** if `wantPure` in | Pure **1200**, else **0**. |
| `shouldWaitForFirstRelay` | 3953 | **this** | **move-only** | `desiredRelayPolicy()`. |
| Offerer first-relay cap | 4099 | inline | **move-only** | `Math.min(relayWaitBudgetMs(), 400)`. |
| Answer first-relay cap | 5402–5405 | inline | **move-only** | `Math.min(budget, warm ? 180 : 220)`. Hop11. **Never global &lt;180.** |
| Hybrid force_relay poll | 5028 | inline | **move-only** | **40** ms (hop9; was 800→120→80→40). |
| `waitForInitialIce` | 2278 | **this** | stay / optional | 40 ms micro-pause; skip if `warmed`. Not a relay budget. |
| `waitWarmTurnPrimed` | 2407 | **this** | stay | Default 1100, **cap 200**. Pure warm never primes (pool=0). |
| Cold GUM race caps | 3174, 5068, 5219 | inline | stay | 150 ms — not hop11 relay. |
| ICE config wait | 841 | **this** | stay | 4000 default; answer path 200/250. |

Suggested constants (names only — values must match disk):

```text
RELAY_WAIT_PURE_MS = 1200
OFFER_FIRST_RELAY_CAP_MS = 400
ANSWER_FIRST_RELAY_WARM_MS = 180
ANSWER_FIRST_RELAY_COLD_MS = 220
OFFER_FORCE_RELAY_POLL_MS = 40
OUTBOUND_WATCH_WAVES_MS = [600, 1200, 2000, 3500, 6000, 10000]
POST_ANSWER_BIND_WAVES_MS = [200, 600, 1500, 3000]
```

P2 (out of this hop): merge recovery waves / change hop budgets. Needs product.ok smoke. Do not cut answer first-relay below 180.

---

## Suggested extract order (later hop — not now)

1. **IceSdpUtils** — all module-level pures + retarget `offerSdpLooksPureRelay.test.mjs`. Lowest risk.
2. **RelayWaitBudgets** — export `waitForIceGatherRelayOrDone` + constants; MediaSession uses same numbers.
3. **ForceRelayPolicy predicates** — `desiredRelayPolicy` / strip / filter as pure snapshot fns. **Not** `setForceRelay` body.
4. **Latch helper** — flags only; all five write sites call it. Smoke required (sticky / keepLocal / arm-only).
5. **`trackUsable`** then bind ctx — only after 1–4 and a product.ok window. `bindAnswerOutbound` last.

Never extract `pcConfig` / `ensureRelayPolicyPc` / `forceRelayRebuild` / answer serial without phone+PC smoke.

---

## Explicit non-goals (this dump)

- Did not edit `MediaSession.ts`, `live.js`, `webrtc.js`.
- Did not implement extract, APK, deploy, pool&gt;0.
- Did not invent product.ok / GOAL_MET for connect.
- `clear outbound timers` listed for ms-safe; this lane documents only.

---

## Cross-links

- Spec P1 table: `knowledge/specs/current-ui-dedupe-connect-cleanup.md`
- Prior anchors: `knowledge/raw/2026-08-12-connect-android-recs.md`
- Sticky wipe: `knowledge/raw/2026-08-10-hub-fr-wiped.md`
- Lock: `docs/CONNECTIVITY_LOCK.md`
