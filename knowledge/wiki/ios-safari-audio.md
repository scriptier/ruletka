# iPhone Safari audio (crackle + delay) — **unverified**

**Status: unverified** — human report only. No scorecard, no av-verify, no iPhone in the wiki session. Agents must not invent `product.ok` / PASS.

**Spec:** [`../specs/current-ios-safari-audio.md`](../specs/current-ios-safari-audio.md)  
**Raw:** [`../raw/2026-08-14-iphone-safari-audio.md`](../raw/2026-08-14-iphone-safari-audio.md)  
**Herd:** `20260814T021357Z` (lanes **ios-boost** `ui/live.js` · **ios-gum** `ui/webrtc.js` · **ios-wiki** this page)

## Symptom

Friend on **iPhone browser** (Safari / WebKit — not the Android app): audio “all messed up”, **crackling**, and a **big delay** between conversationalists. 1v1 turn-taking does not feel live.

Treat as **unverified product FAIL** on iOS WebKit `live.html`. Not claimed: Android FAIL · ICE FAIL · “fixed”.

## Why it matches the code (director inspect at report time)

Comment in `ensureMicBoost`: *“Unity: skip Web Audio so browser AEC stays on the raw capture track.”* Default is **125%**, so iPhone always leaves AEC and hits a Web Audio resample + compressor. That matches **crackle + delay**.

| # | Suspect | Why it hurts Safari |
|---|---------|---------------------|
| 1 | `ui/live.js` `MIC_BOOST_DEFAULT = 125` → `ensureMicBoost` always builds Gain + DynamicsCompressor + MediaStreamDestination unless `pct === 100` | Leaves browser AEC; extra graph + dest track = delay / artifacts |
| 2 | `ui/webrtc.js` `sampleRate: { ideal: 48000 }` in both `fullProcessingAudioConstraints` and `lowLatencyAudioConstraints` | WebKit `AudioContext` is often **44100**; GUM/WebRTC **48k** → resample **crackle** |
| 3 | `startMeter` `createMediaStreamSource(previewStream)` | Taps the **live send** graph (second AC on the same track) |
| 4 | NS + AGC default on (`lowLatencyAudio` default OFF) | Adds 20–80ms; already documented in `lowLatencyAudioConstraints`; **secondary** to (1) |

## Code hop status (disk 2026-08-14 — **not** human PASS)

Herd `20260814T021357Z` 4/4 GOAL_MET (static). Director pin: **`live.js?v=574`** · **`webrtc.js?v=317`**.

| Gate | Disk |
|------|------|
| `ensureMicBoost` iOS short-circuit | **yes** — `isIosWebKit()` then `stopMicBoost()` / raw track |
| `startMeter` clone on iOS | **yes** — `meterTapTrack = track.clone()` |
| iOS omits `sampleRate` 48000 | **yes** — both constraint helpers |
| Human iPhone Safari smoke | **open** — do not invent PASS |

Desktop mic-boost 125% unchanged. `pool=0`. No MediaSession.

## GOAL / DONE WHEN (from spec)

GOAL: iPhone Safari 1v1 audio is intelligible and turn-taking feels live — not crackly, not half-second late.

1. iOS/WebKit never routes outbound mic through the Web Audio mic-boost graph.
2. Mic meter on iOS does not tap the live send track (clone or skip).
3. iOS GUM does not force `sampleRate` ideal 48000.
4. `live.html` cache-bust after JS change (director pin).
5. This wiki page + raw user report filed.

## EVAL

- grep/static: `ensureMicBoost` short-circuits on iOS/WebKit; `startMeter` uses a cloned track or no AC tap on iOS.
- `webrtc.js` iOS path omits `sampleRate:{ideal:48000}`.
- No `pool>0`, no `force_relay` / hop budget / MediaSession rewrite.
- **Human iPhone Safari smoke (friend or later) is the product gate — agents must not invent PASS.**

## MUST NOT

- Invent `product.ok` / human PASS / GOAL_MET from wiki or static grep.
- Touch `MediaSession.ts`, ICE, TURN, hop budgets, `iceCandidatePoolSize` (pool=0 forever).
- Dual-write `ui/live.js` or `ui/webrtc.js` (one writer per file: ios-boost / ios-gum).
- Default `lowLatencyAudio=true` globally (kills NS on desktop).
- Native iOS App Store · Android APK · mic-boost UX rewrite for desktop.
- More than **2 hops** without a human iPhone paste.

## Lanes

| Lane | OWN | Do |
|------|-----|-----|
| **ios-boost** | `ui/live.js` | iOS/WebKit bypass mic-boost graph; meter clone |
| **ios-gum** | `ui/webrtc.js` | iOS omit forced 48000; keep AEC; no ICE |
| **ios-wiki** | this page + index/log/gotchas/resources | File the report + gotcha **27** |
| pin | `ui/live.html` | Director after writers |

## Product gate

No iPhone in the wiki session. Re-smoke: friend (or later human) iPhone Safari ↔ PC/Android, hard-refresh after director pin. Static EVAL ≠ product.

### Log

- 2026-08-14: filed from raw `2026-08-14-iphone-safari-audio.md` + spec `current-ios-safari-audio.md`. Herd `20260814T021357Z`. Code hop **in progress** (not claimed shipped). **unverified** until human Safari smoke.
