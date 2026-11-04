# Raw: iPhone Safari audio crackle + delay

**Date:** 2026-08-14  
**Source:** human (operator) — friend used **browser on iPhone** (not Android app).  
**Symptom:** audio “all messed up”, **crackling**, and a **big delay** between conversationalists.

No scorecard, no av-verify, no device logs. Treat as **unverified product FAIL** on iOS WebKit live.html.

## Code suspects at report time (director inspect)

1. `ui/live.js` `MIC_BOOST_DEFAULT = 125` → `ensureMicBoost` always builds Web Audio (Gain + DynamicsCompressor + MediaStreamDestination) unless pct===100. Comment says unity skip is required for AEC.
2. iOS `AudioContext` sample rate often **44100**; GUM/WebRTC **48000** (`webrtc.js` `sampleRate: { ideal: 48000 }`) → resample crackle.
3. `startMeter` `createMediaStreamSource(previewStream)` taps the live send graph.
4. NS+AGC default on adds 20–80ms (already documented in `lowLatencyAudioConstraints`); secondary to (1).

## Not claimed

product.ok · Android FAIL · ICE FAIL · “fixed” without Safari smoke.
