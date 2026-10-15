# Raw: iPhone Safari RTP / Opus / ptime / FEC / jitter / playout

**Date:** 2026-08-14  
**Lane:** `ios-rtp` · RUN `20260814T021357Z`  
**READ (not edited):** `ui/webrtc.js`, `docs/CONNECTIVITY_LOCK.md`  
**Sibling (capture, not this dump):** `knowledge/raw/2026-08-14-iphone-safari-audio.md`  
**Not claimed:** product.ok · Android FAIL · ICE FAIL · “fixed” · human Safari PASS

Inventory only. **Do not implement this hop.**

---

## Honest summary

`ui/webrtc.js` does **not** munge Opus FMTP. There is **no** `ptime`, `minptime`, `useinbandfec`, `usedtx`, `maxaveragebitrate`, `maxplaybackrate`, `stereo`, `cbr`, `sprop-*`, or `a=ptime` rewrite. Browser stack defaults (typically Opus 20 ms + inband FEC on in Chrome; WebKit’s own SDP) go on the wire.

There **is** interesting receive-side delay: `jitterBufferTarget` / `playoutDelayHint` (55–160 ms, audio **and** video), a hard 60 ms kick after ICE, a 1.8–2.5 s adapt loop that can **raise** both targets, a flat **32 kbps** audio `maxBitrate`, and `setCodecPreferences` that ranks `audio/red` after Opus.

Those receive hints are the main conversational-delay suspects **if** iOS Safari honors them. If Safari ignores them (likely for `playoutDelayHint`; `jitterBufferTarget` support is newer / incomplete), they are no-ops and the delay is **not** in this RTP layer (see capture dump + live.js mic-boost).

---

## Present (cite `ui/webrtc.js`)

| Symbol | ~line | What it does | iOS Safari delay risk |
|--------|------:|--------------|------------------------|
| `preferCodecs` audio order | 981–982 | `setCodecPreferences` ranks `audio/opus`, then `audio/red`, then `audio/PCMU`. No FMTP filter (unlike H264 `packetization-mode=1` at 1002). | **RED** (RFC 2198) wraps a redundant copy of the previous packet → typically **+1 ptime (~20 ms)** if negotiated. Safari often does **not** advertise `audio/red`; then this is a no-op. If a future WebKit build lists RED, PC↔iPhone could pick it. PCMU last is fallback only (10/20 ms, no FEC). |
| `applySenderEncoding` | 1016–1042 | `RTCRtpSender.setParameters` writes `encodings[0].maxBitrate` (and video fps/scale). Safe no-op if unsupported. | Safari historically flaky on audio `setParameters`. If honored, 32 kbps (below) can add encode queue / constrain CBR-like speech; if ignored, unused. |
| `QUALITY_TIERS` | 1046–1071 | Video ladder only: 1.8 M / 900 k / 400 k / 200 k. **Not audio.** | No direct audio delay. Video tier changes re-enter `applyQualityTier` which **re-applies** audio 32 kbps. |
| `applyLowLatencyPlayout` | 1193–1225 | Default **70 ms**. Clamp **55–220**. Sets `receiver.jitterBufferTarget = ms` (spec, milliseconds) and Chromium `playoutDelayHint = ms/1000` (seconds). Same value on **audio and video**. Also `contentHint = "speech"` on inbound audio. | **Primary RTP delay knob.** 55–70 ms is an extra playout floor on top of capture + net. WebKit: `playoutDelayHint` is **Chromium-only** (no-op). `jitterBufferTarget` may be missing or differently implemented; `in` check skips if absent. If WebKit implements it loosely, 55 ms can **underrun** (crackle) on cellular/Wi‑Fi — comments at 1195 / 1400–1401 already warn. Setting inbound `contentHint` is unusual; Safari may ignore. |
| `kickMediaAfterIce` | 1260–1284 | On ICE checking/connected (and black-watch / answer timers): `applyLowLatencyPlayout(pc, **60**)` then video keyframe burst 0/80/200/500 ms. | **Snaps both A/V targets to 60 ms** whenever ICE flaps or black-watch fires. Callers: 2147, 2201 (checking), 2209, 2279 (`ontrack`, **default 70**), 3235/3249/3270, 3530 + 120/400/1200 ms (3540–3551). Repeated 60↔70↔adaptive jumps can glitch Safari’s jitter buffer even if the API is a no-op (cheap). |
| `fullProcessingAudioConstraints` | 1326–1336 | `echoCancellation` + NS + AGC; `latency: { ideal: 0.02, max: 0.08 }`; `sampleRate: { ideal: 48000 }`; mono. | Capture, not RTP. **+20–80 ms** algorithmic (comment 1288, 1341). Default path. 48 kHz vs iOS 44.1 kHz AudioContext is the **sibling** crackle suspect. |
| `lowLatencyAudioConstraints` | 1346–1363 | AEC always on. NS/AGC off only if Settings `lowLatencyAudio`. Latency 5/25 ms (low) vs 20/80 (default). | Default **OFF** (1317–1320) → full NS+AGC. Not Opus FMTP. |
| `isTurnPreferredPath` / `isRelayMediaMode` | 1369–1388 | Hide IP / hub `force_relay` → treat path as TURN for **playout floors**. | Relay floors are **higher** (see next). Extra 20–50 ms vs P2P when Hide IP / same-public-IP (lock: `CONNECTIVITY_LOCK.md` 33–35, 54–56). |
| `playoutTargetForTier` | 1397–1422 | Matched A/V target by tier + relay + low-lat pref. Relay: 90–150. P2P low-lat: 60–90. P2P default: **70 / 85 / 110**. | Default conversational extra **70–110 ms** receive buffer (150 on relay+low tier). Conservative by design (“too-low … crackle”). iOS cellular often looks like “min/low” → **110–150 ms** if the API works. |
| `_tagTracks` | 1560–1574 | Local audio `contentHint = "speech"`. | May bias Safari encoder toward speech/DTX. Unverified on WebKit. Low risk vs jitter targets. |
| `applyQualityTier` audio | 1688–1690 | **Every** tier: `applySenderEncoding(sender, { maxBitrate: 32_000 })`. Comment: “~32 kbps speech Opus — lower encode buffering than music-rate”. | Caps outbound audio at 32 kb/s via encodings API, **not** SDP `maxaveragebitrate`. Chrome default Opus is often ~32–40 kb/s speech anyway. Safari: may ignore. Does **not** set DTX/FEC. Re-applied on every video-tier change. |
| `_startAdaptiveQuality` | 1696–1706 | Interval **1800 ms** relay / **2500 ms** else → `_adaptOnce`. | Frequent `jitterBufferTarget` writes (see next). |
| `_adaptOnce` jitter + playout | 1715–1844 | Reads inbound `r.jitter` (seconds). Audio limit 50 ms (65 ms relay) contributes to “loss” EMA → video tier drop. Then `playoutTargetForTier`; if `estimateAvPlayoutLag` \|lag\| > 70 ms, **bump both** targets by up to 35 ms, **cap 160**. Smooth ±12 ms/tick. `applyLowLatencyPlayout`. | **Can grow receive delay to 160 ms** when stats say audio/video buffers disagree. Safari `getStats` `jitterBufferDelay` / `jitterBufferEmittedCount` exist but units/availability vary. False lag → unnecessary +35 ms. Jitter thresholds do not change Opus FEC; they only step video quality + playout. |
| `estimateAvPlayoutLag` | 1890–1911 | `jitterBufferDelay / jitterBufferEmittedCount * 1000`. `lagMs = audioMs - videoMs`. If audio-only, treats audioMs > 80 as lag. | Feeds the bump above. If Safari reports a large cumulative audio jitter-buffer delay (common), the loop **adds** delay to “match” video instead of shrinking audio. |
| `createOffer` options | 2801–2808 | `{ offerToReceiveAudio: true, offerToReceiveVideo: true }` (+ `iceRestart` when restarting). **No** `voiceActivityDetection` flag. | DTX left to UA default. Not a ptime/FEC set. |

### SDP functions (ICE only — not media)

These rewrite SDP but **only** `a=candidate:` lines. They do **not** touch `m=audio`, `a=rtpmap`, `a=fmtp`, `a=ptime`, `a=rtcp-fb`.

| Symbol | ~line | What |
|--------|------:|------|
| `stripHostCandidatesFromSdp` | 272–287 | Drop `typ host`. |
| `stripMdnsHostCandidatesFromSdp` | 330–349 | Drop `*.local` host. |
| `stripNonRelayCandidatesFromSdp` | 401–428 | Drop non-relay when ≥1 relay remains. |
| `sanitizeRemoteDescription` | 487–499 | mDNS always; then relay-or-host strip. Same pattern on local emit ~2904–2912, ~3492–3501. |

**This hop MUST NOT extend these into Opus/ptime/FEC munging.**

### Pool lock (already 0)

| Symbol | ~line |
|--------|------:|
| `ICE_CANDIDATE_POOL_SIZE = 0` | 13–17 (comment: pool≥2 ALLOCATE storms) |
| `ICE_RELAY_POOL_SIZE = 0` | 19 |
| `DEFAULT_ICE.iceCandidatePoolSize` | 27 |
| `getIceConfig` / warm PC | 520, 566, 715, 729 — all 0 |

`docs/CONNECTIVITY_LOCK.md` L55: force_relay path is “UDP TURN only, **pool=0**”.

---

## Absent (searched `ui/webrtc.js` — honest)

| Item | Present? | Note |
|------|----------|------|
| `a=ptime` / `minptime` / `maxptime` | **No** | No 10/20/40/60 ms override. Stack default (usually 20). |
| Opus `useinbandfec` | **No** | Not set via FMTP or API. UA default (Chrome often `1`). |
| Opus `usedtx` | **No** | No `voiceActivityDetection` on `createOffer`. |
| `maxaveragebitrate` / `maxplaybackrate` | **No** | Bitrate is encodings `maxBitrate` 32_000 only. |
| `stereo=1` / `cbr=` / `sprop-stereo` | **No** | Mono via GUM `channelCount: 1` (1332, 1356) only. |
| ulpfec / flexfec / RED payload map | **No** except prefer-order `audio/red` | No `a=rtpmap` RED/ulpfec inject. |
| NACK / `rtcp-fb` for audio | **No** | NACK mentioned only as a **comment** on video outbound-rtp (1756). |
| Audio `degradationPreference` | **No** | Video only (`balanced`, 1686). |
| iOS / Safari UA branch for RTP | **No** | `isAndroidUa` exists (~1083) for video multi-tier. **No** `isSafari` / `isIOS` in this file for codecs/playout. |

If a later hop needs Opus ptime/FEC, that is **new work** and **not** a one-line flip. SDP munging is out of scope (below).

---

## Delay budget (if WebKit honors the hints)

Rough **added** receive playout vs “UA default” (UA default is often 40–80+ ms already; these **override** toward the numbers below):

| Path | Target applied | Where |
|------|----------------|--------|
| ICE just up | **60 ms** both A/V | `kickMediaAfterIce` 1263 |
| `ontrack` before adapt | **70 ms** (fn default) | 2279 |
| P2P, default prefs, high/mid | **70 / 85 ms** | 1420–1421 |
| P2P, poor net (min/low) | **110 ms** | 1419 |
| Relay / Hide IP | **100–150 ms** | 1402–1411 |
| Adapt lag bump | up to **160 ms** | 1832–1834 |

Plus capture (sibling): NS+AGC 20–80 ms default; `latency` ideal 20–80 ms; optional live.js mic-boost graph.

**“Big delay”** reported on iPhone browser is **not explained by ptime/FEC code** (there is none). It **can** be explained by 60–160 ms jitter targets **if Safari applies them**, plus capture processing + any Web Audio graph. If Safari ignores the hints, look at capture / AudioContext 44.1 vs 48 k, not this RTP file.

---

## MUST NOT (this hop and lock)

From the lane card + `docs/CONNECTIVITY_LOCK.md`:

1. **No SDP media munging** — do not inject/edit `a=fmtp` / `a=ptime` / Opus params. Existing SDP helpers are **ICE-candidate-only** (webrtc.js 272–499). Extending them to media is a new, smoke-gated hop.
2. **`iceCandidatePoolSize` stays 0** — webrtc.js 17–19, 27, 715; lock L55. Never pool≥1.
3. **No ICE / force_relay / offerer-role changes** — lock L51–58, L100–116. Web remains preferred offerer vs iOS; answerer does not re-offer; no mid-call force_relay arm; no `pair_force_relay` for all web↔android.
4. **No dual-offer / addTrack-before-setRemote** — lock L52–53.
5. **Do not implement** in this lane. Inventory only. No `ui/webrtc.js` / `ui/live.js` / `MediaSession.ts` edits from this dump.
6. **Do not invent product.ok** or claim iOS audio fixed.

CONNECTIVITY_LOCK has **zero** Opus/ptime/FEC/jitter symbols (grep empty). It does not authorize RTP munging.

---

## Suggested next (not this hop)

- **Measure on device**, do not guess: Safari Web Inspector / `getStats` for `inbound-rtp` audio `jitterBufferDelay`, `jitterBufferTarget` presence, and remote SDP `a=fmtp:.*opus` (`useinbandfec`, `usedtx`, `ptime`).
- If `jitterBufferTarget` **is** in the receiver: consider **not** applying 60 ms on ICE checking (2201) on WebKit, or a higher iOS floor — **separate** implement lane + Safari smoke.
- If it is **absent**: this file is not the delay source; stay on capture / Web Audio (sibling raw).
- **Do not** add `ptime=10` or `useinbandfec=0` via SDP to “fix delay” without a spec + smoke. 10 ms ptime raises packet rate; turning FEC off can increase conceal delay on loss.

---

## Files read

- `/home/drakosik/freenet-roulette/ui/webrtc.js` (lines cited above)
- `/home/drakosik/freenet-roulette/docs/CONNECTIVITY_LOCK.md` (L33–35, L49–58, L100–116)
- `/home/drakosik/freenet-roulette/knowledge/raw/2026-08-14-iphone-safari-audio.md` (sibling; not duplicated)
