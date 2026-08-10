# Task: P0 — Browser kickSolo / warm path speed

**Priority:** MUST — complementary to 001 (web is preferred offerer).  
**Judge note (overnight):** 001 already audited this path as ≤~1.3s worst-case after `0d61dbb`. Prefer **short close-out**, not a second full re-trace.

## Goal
Confirm browser still starts WebRTC / **createOffer** immediately on match (warm preview, `kickSoloWebRtc` not blocked by modals/UI, no joinPeers teardown of a live offer). Patch **only** if a residual multi-second stall is proven that 001 did not cover.

## Context
- Roadmap C2: harden kickSolo; hub should show 1 offer from **web** when web is offerer
- **001 RESULT** (`tasks/admin-queue/done/20260807T123651Z-001-connect-slow-offer-RESULT.md`): web match→offer already under budget (GUM 900ms race, connect watchdog, 80ms micro-ICE); prior ~25s MTO blamed on **double matched / thrash → 003**, not kickSolo idle
- Slow MTO after thrash is fixed is the only reason to re-open deep surgery here

## Scope (only these)
- `ui/live.js` — `kickSoloWebRtc`, `handleMatched`, modal dismiss, startPreview
- `ui/webrtc.js` — only if `startCall` / connect is delayed after kick
- No mobile changes (002 owns Play answer path)
- Do **not** re-implement 003 thrash guards inside this ticket

## Done criteria
- [ ] Cross-ref 001 RESULT: either **COMPLETE = already optimal** with file:line confirmation (spot-check, not full rewrite of the latency table) **or** one new residual stall with file:line + minimal fix
- [ ] Does not create second offer (leave thrash to 003)
- [ ] Verify hint if hub has traffic: `./scripts/hub-match-speed.sh 30` (IDLE is OK to note)
- [ ] RESULT: connect risk + no deploy / no push

## Completion promise
Put **`COMPLETE`** in RESULT when done criteria met. “Already optimal + 001 evidence” is a valid COMPLETE.

## Do not
- joinPeers rewrite / full live.js refactor
- Fold 003 rematch/double-offer fixes into this ticket
- Deploy / push / merge main

