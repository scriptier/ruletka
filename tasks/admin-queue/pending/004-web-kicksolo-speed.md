# Task: P0 — Browser kickSolo / warm path speed

## Goal
Ensure browser starts WebRTC / offer path immediately on match (preview warm, kickSolo not delayed by UI modals). Complementary to 001.

## Scope
- `ui/live.js` kickSoloWebRtc, handleMatched, modal dismiss
- `ui/webrtc.js` only if startCall delayed

## Done criteria
- [ ] Latency notes + fix or "already optimal"
- [ ] No deploy
