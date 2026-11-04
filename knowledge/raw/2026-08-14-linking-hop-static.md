# Raw: linking hop10/11 static reconfirm (post iOS Safari sampleRate omit)

**Date:** 2026-08-14  
**Lane:** `link-static` · RUN `20260814T021956Z`  
**READ (not edited):** `ui/live.js`, `ui/webrtc.js`  
**Why now:** iOS Safari audio hop (`ios-gum`) gated GUM `sampleRate` on `isIosWebKit`. Reconfirm hop10/11 linking belts + pool lock + dual-offer mutex still on disk.  
**Sibling:** `knowledge/raw/2026-08-14-iphone-safari-audio.md` · `knowledge/raw/2026-08-14-linking-brainstorm.md`  
**Not claimed:** product.ok · linking-speed GOAL_MET · human Safari PASS · deploy · APK

Static grep/read only. **No code edits this hop.**

---

## Verdict (static — not product)

| Belt | Expected | Disk | Cite |
|------|----------|------|------|
| `ICE_CANDIDATE_POOL_SIZE` | **zero** | **zero** every write | `webrtc.js` L17 L19 L27 L520 L529 L551 L561 L566 L715 L729 |
| `relayWaitBudgetMs` | **480** pure / **300** hybrid | **480 / 300** | `webrtc.js` L314–L321 |
| `connectBudgetMs` | **1100** pure offerer | **1100** (hybrid 750 / answerer 1800) | `live.js` L27224–L27229 |
| `inflightGrace` | **1100** force_relay | **1100** (hybrid **400**) | `live.js` L10347–L10351 |
| iOS omits `sampleRate` 48000 | omit on WebKit | **yes** both constraint helpers | `webrtc.js` L1098–L1111, L1355–L1358, L1384–L1387 |
| dual-offer mutex | no obvious regression | **intact** | `live.js` L26743–L26783, L10433–L10438 · `webrtc.js` L2518, L2599–L2686, L2802–L2803, L2950–L2954 |

**Honest drift (comments only — values did not regress):**

1. `live.js` L10347–L10349 comment still says first-relay “webrtc **~520+350**” (hop9). Hop11 function is **480 / 300**. Grace **value** is still 1100.
2. `live.js` L26745–L26746 comments: “Hop10: re-entry if stuck **>800ms**” / “Hop11: free at **550ms**”. Code is `stuckMs < **400**` (hop9 floor). Old 2026-08-11 “hop11” name was the 550ms free-stuck wave — not today’s hop11 wait cut. Mutex **behavior** is skip-if-emitOk or young `<400`.
3. `wiki/linking-speed.md` hop table still ends at hop10 (520/350 in hop9 lane text). Disk wait is hop11 **480/300**. Wiki is another lane (`link-wiki`).

No positive ICE pregather. No second offerer path added by the iOS hop. **Not** linking-speed GOAL_MET. **Not** product.ok.

---

## 1. Pool lock = zero (`ui/webrtc.js`)

```
L17  ICE_CANDIDATE_POOL_SIZE  →  0
L19  ICE_RELAY_POOL_SIZE      →  0   (defined, unused as a write — not a leak)
L27  DEFAULT_ICE copies the constant (still zero)
```

`applyIceDirectPreference` starts from the constant and **re-zeros** hide / force_relay / normal:

- L520 start: local copy of `ICE_CANDIDATE_POOL_SIZE`
- L529 hide_ip TURN path: forced zero
- L551 force_relay: forced zero (comment L537: “pure policy=relay + ONE UDP TURN + pool=0”)
- L561 normal path: forced zero
- L566 written onto the RTCConfiguration

Warm PC:

- L715 pure: literal zero
- L729 hybrid: copies `ICE_CANDIDATE_POOL_SIZE` (still zero)

Grep of `ui/live.js` + `ui/webrtc.js`: the RTCConfiguration pregather field appears only at those lines. **No raise. Lock holds.**

---

## 2. `relayWaitBudgetMs` 480 pure / 300 hybrid (`ui/webrtc.js`)

```313:322:ui/webrtc.js
/** Max ms to wait for first typ relay before emit. */
function relayWaitBudgetMs() {
  // Pure same-IP: first relay often lands ~0.8–1.5s; cap so mto isn't stuck at 1.7s+.
  // waitForIceGatherRelayOrDone exits early on first typ relay (does not always burn full budget).
  // Hop3: 1100→850; hop7: 850→700; hop8: 700→600; hop9: 600→520; hop11: 520→480.
  // rebuild-if-n=0 belt still on pure offer. product.ok re-smoke required after deploy.
  if (hideIpRelayOnlyEnabled() || sessionForceRelayEnabled()) return 480;
  // Hop7 hybrid: first-pass 400. Hop8: 350. Hop9: 320. Hop11: 300 — still wait when TURN present.
  return 300;
}
```

Offer first-pass uses that budget (L2851–L2855): warm `Math.min(budget, 320)` · cold = budget (480) · multiFast cold cap 450 (never lengthens 1v1). Second wait hop11 (L2867–L2878): pure cold **320** · warm/hybrid **280**.

Answer same schedule (L3473–L3503): comment “Hop11: same schedule as offer (cold pure 480 / warm first 320 / hybrid 300).”

iOS `sampleRate` hop did **not** retouch these numbers.

---

## 3. `connectBudgetMs` 1100 pure offerer (`ui/live.js`)

```27222:27229:ui/live.js
  // Bound connect so hung createOffer cannot hold kickSolo mutex forever.
  // offerKick frees inflight too; this is belt for first path.
  // Hop10 connect: pure force_relay offerer 1100ms (≥ pure wait ~870 + slack);
  // hybrid offerer 750; answerer 1800. Free ASAP when emit already ok.
  // Never leave _inflight stuck — finally always clears.
  try {
    const purePath = !!(msg && msg.force_relay);
    const connectBudgetMs = iOffer ? (purePath ? 1100 : 750) : 1800;
```

Comment “≥ pure wait ~870” is **stale vs hop11 480** (historical hop3-era slack). **Literal is still 1100.** Poll 40ms (L27283). `finally` always clears `_inflight` (L27299–L27301).

Hop10 offerer GUM still async SDP-first (L26800–L26836): does not `await` cold GUM before `connect()`.

---

## 4. `inflightGrace` 1100 force_relay (`ui/live.js`)

```10347:10351:ui/live.js
        // In-flight without local yet: pure force_relay must cover first-relay
        // wait (webrtc ~520+350) + offerer connectBudget (~1100). hop10 grace
        // 1100 (was 700) so offerKick does not tear mid-pure gather. Hybrid 400.
        // Stuck-local re-emit still fires every wave (below).
        const inflightGrace = msg?.force_relay ? 1100 : 400;
```

**Value 1100 / 400 matches hop10.** Comment “~520+350” is hop9 leftover (hop11 first-pass 480 / second 320). Grace is still large enough for hop11 wait + connect budget. Hybrid grace 400 unchanged.

offerKick waves still dense (L25742–L25748): force_relay `[0, 80, 180, 320, 480, 750, 1200, 2000, 3500, 4500]`.

---

## 5. iOS omits `sampleRate` 48000 (`ui/webrtc.js`)

UA helper (same rules as `live.js`):

```1093:1110:ui/webrtc.js
/**
 * iPhone / iPad / iPod WebKit, including iPadOS desktop-mode Safari.
 * Same UA rules as live.js: iPhone|iPad|iPod or MacIntel + maxTouchPoints > 1.
 * WebKit AudioContext is often 44100 — do not force GUM 48k (resample crackle).
 */
function isIosWebKit() {
  try {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) return true;
    // iPadOS 13+ reports as Macintosh / MacIntel.
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
```

Both GUM helpers set 48k **only when not iOS**:

```1355:1358:ui/webrtc.js
  // Desktop prefers 48k Opus. iOS/WebKit AC is often 44.1k — omit forced 48k.
  if (!isIosWebKit()) {
    c.sampleRate = { ideal: 48000 };
  }
```

```1384:1387:ui/webrtc.js
  // Desktop prefers 48k Opus. iOS/WebKit AC is often 44.1k — omit forced 48k.
  if (!isIosWebKit()) {
    c.sampleRate = { ideal: 48000 };
  }
```

Desktop path **unchanged** (`sampleRate: { ideal: 48000 }` still assigned).

Call site L1569–L1572: `lowLatencyAudioConstraints(...)` extra is `deviceId` only — **does not re-inject 48k** over the iOS omit.

`ui/live.js` `sampleRate` hits (L6129, L6153) are `AudioContext.createBuffer` tone buffers, **not** GUM. kickSolo `gumConstraints` (L26807–L26818) has AEC/NS/AGC only — no `sampleRate`.

iOS hop also left `ensureMicBoost` short-circuit (`live.js` L18013–L18016) and meter clone (L17796–L17806). Those are audio, not linking belts. **Human Safari smoke still open** (wiki `ios-safari-audio.md`).

---

## 6. Dual-offer mutex — no obvious regression

### kickSolo inflight mutex (`ui/live.js`)

```26743:26760:ui/live.js
  // Mutex: concurrent kickSolo (matched race / retry) was dual-PC → 2nd offer@800ms.
  // But hung await connect() held _inflight forever → offerKick concurrent-skip
  // every wave until hardMs ~25s. Hop10: re-entry if stuck >800ms without emit.
  // Hop11: free at 550ms. Hop9: free at 400ms so ≤400ms offerKick recovery can re-enter.
  // If emit already ok, always skip (never dual-offer thrash).
  if (kickSoloWebRtc._inflight && kickSoloWebRtc._inflightPeer === peerId) {
    const stuckSince = kickSoloWebRtc._inflightAt || 0;
    const stuckMs = stuckSince ? Date.now() - stuckSince : 99999;
    let emitOk = false;
    try {
      const cur = findPcForPeer(peerId);
      emitOk = !!(cur && (cur._offerEmitOk || cur._gotRemoteAnswerAt));
    } catch (_) {}
    if (emitOk || stuckMs < 400) {
      log(
        `kickSolo skip concurrent peer=${String(peerId).slice(0, 8)} stuck=${stuckMs}ms emit=${emitOk ? 1 : 0}`
      );
      return;
```

Then **skip if match already offered on the wire** (L26769–L26783): requires `_offerEmitOk` (stamp alone no longer blocks recovery). Then `_inflight = true` (L26795).

offerKick frees hung mutex before re-kick (L10433–L10438).

### `_createAndSendOffer` (`ui/webrtc.js`)

- L2518: “Early promote = dual-offer thrash → black cams.”
- L2600: `if (this._offerInFlight) return false;`
- L2608–L2611: skip if match already offered **and** `_offerEmitOk` (12s)
- L2655–L2676: skip if already answered / already got remote answer (15s)
- L2678–L2681: one non-restart offer per PC if `_offerSentOnce && _offerEmitOk`
- L2684–L2686: latch without wire → allow recovery (`_offerSentOnce = false`)
- L2802–L2803: `_offerInFlight = true` — **do not** set `_offerSentOnce` until emit
- L2950–L2954: emit, **then** `_offerEmitOk = true` and `_offerSentOnce = true`

iOS hop did not add a second createOffer, did not drop the mutex, did not set `_offerSentOnce` before emit.

---

## What this is not

- **Not** linking-speed GOAL_MET (stretch still mto under 800 warm / under 1500 pure · mta under 2500; latest cited journal in brainstorm is 1498/2685 — other lanes).
- **Not** product.ok invented from grep.
- **Not** iPhone Safari audio PASS.
- **Not** a hop-budget cut. Brainstorm: do not cut `relayWaitBudgetMs` below 480 without re-smoke.

---

## Files read

- `/home/drakosik/freenet-roulette/ui/webrtc.js` (pool lock, `relayWaitBudgetMs`, `isIosWebKit`, sampleRate gates, offer mutex)
- `/home/drakosik/freenet-roulette/ui/live.js` (connectBudget, inflightGrace, kickSolo mutex, offerKick)
- Context only (not OWN): `knowledge/specs/current-linking-speed.md`, `knowledge/wiki/linking-speed.md`, `knowledge/raw/2026-08-14-linking-brainstorm.md`, `knowledge/specs/current-ios-safari-audio.md`
