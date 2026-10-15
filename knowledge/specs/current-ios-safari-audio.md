# Spec: iPhone Safari audio (crackle + conversational delay)

**Status:** Active — herd hop 2026-08-14  
**Date:** 2026-08-14  
**Source:** human — friend on **iPhone browser** (Safari/WebKit): crackling + big delay between speakers.

```text
GOAL: iPhone Safari 1v1 audio is intelligible and turn-taking feels live — not crackly, not half-second late.
DONE WHEN:
  1) iOS/WebKit never routes outbound mic through the Web Audio mic-boost graph (default 125% today always builds Gain+Compressor+MediaStreamDestination).
  2) Mic meter on iOS does not tap the live send track (clone or skip).
  3) iOS GUM does not force sampleRate ideal 48000 (WebKit AudioContext is often 44100 → resample crackle).
  4) live.html cache-bust after JS change (director pin).
  5) Wiki page + raw user report filed.
EVAL:
  - grep/static: ensureMicBoost short-circuits on iOS/WebKit; startMeter uses a cloned track or no AC tap on iOS.
  - webrtc.js iOS path omits sampleRate:{ideal:48000}.
  - No pool>0, no force_relay / hop budget / MediaSession rewrite.
  - Human iPhone Safari smoke (friend or later) is the product gate — agents must not invent PASS.
CHECKPOINTS:
  - Deploy/prod pin = human. Disk pin only this hop.
  - Do not default lowLatencyAudio=true globally (kills NS on desktop).
OUT OF SCOPE:
  - Native iOS App Store
  - Android MediaSession / APK
  - P2 hop budgets, ICE, TURN
  - Mic-boost UX rewrite for desktop
VERIFY:
  - Baseline: code inspection (MIC_BOOST_DEFAULT=125 always graphs)
  - After: static + optional tiny helper tests
  - Product: human iPhone Safari ↔ PC/Android
LANE: web audio (live.js) + web GUM (webrtc.js) + wiki
MUST NOT: pool>0, MediaSession.ts, deploy, APK, dual-write same file
MAX HOPS: 2 without human iPhone paste
```

## Why this first (not vibe)

Comment in `ensureMicBoost`: *“Unity: skip Web Audio so browser AEC stays on the raw capture track.”* Default is **125%**, so iPhone always leaves AEC and hits a Web Audio resample + compressor. That matches **crackle + delay**.

## Lanes

| Lane | OWN | Do |
|------|-----|-----|
| **ios-boost** | `ui/live.js` | iOS/WebKit bypass mic-boost graph; meter clone |
| **ios-gum** | `ui/webrtc.js` | iOS omit forced 48000; keep AEC; no ICE |
| **ios-wiki** | `knowledge/wiki/ios-safari-audio.md` + raw + index/log | File the report + gotcha |
| pin | `ui/live.html` | Director after writers |

## Honest

No iPhone in this session. **Unverified** until human Safari smoke.
