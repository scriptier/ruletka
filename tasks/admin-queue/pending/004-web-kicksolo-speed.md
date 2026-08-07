# Task: P0 — Browser kickSolo / warm path speed

**Priority:** MUST — complementary to 001 (web is preferred offerer).

## Goal
On match, browser starts WebRTC / **createOffer** immediately: preview warm, `kickSoloWebRtc` not blocked by modals/UI, no joinPeers teardown of a live offer.

## Context
- Roadmap C2: harden kickSolo; hub should show 1 offer from **web** when web is offerer
- Slow MTO often means web sat idle after match until something kicked WebRTC
- If 001 already fixed the same path, RESULT may be “already optimal” with evidence

## Scope (only these)
- `ui/live.js` — `kickSoloWebRtc`, `handleMatched`, modal dismiss, startPreview
- `ui/webrtc.js` — only if `startCall` / connect is delayed after kick
- No mobile changes unless RESULT points there → hand off to 002

## Done criteria
- [ ] Latency notes: match → kickSolo → createOffer (where time goes)
- [ ] Minimal fix **or** “already optimal” with file:line evidence
- [ ] Does not create second offer (coordinate with 003)
- [ ] Verify hint: `./scripts/hub-match-speed.sh 30`
- [ ] No deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met.

## Do not
- joinPeers rewrite / full live.js refactor
- Deploy / push / merge main
