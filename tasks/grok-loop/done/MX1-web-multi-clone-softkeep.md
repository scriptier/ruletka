# MX1: Web multi outbound + softKeep (Android↔PC)

## Goal
Harden PC/browser multi so Android peers don't freeze on find-3rd / 3-way join.

## Spec
knowledge/specs/MULTI-CROSS-IMPROVE-PLAN.md P0/P1 · skill multi-party-stage

## OWN
- `ui/live.js` ONLY
- RESULT: tasks/grok-loop/done/MX1-web-multi-RESULT.md

## Do
1. Audit `outboundVideoTrackForPc` / `ensureOutboundVideoClone` / `pushOutboundVideoTracks` — secondary always clone
2. Audit `softKeepPartnerPaint` + `handleFindThirdResult` — waves after Android accept
3. Audit multi-audio / quality only when peerPcs.size ≥ 2
4. Fix clear gaps only (minimal diff)
5. Bump live.js?v= in live.html if code changes (do not deploy unless already authorized overnight)

## Must not
MediaSession, webrtc.js thrash, pool>0, invent multi PASS

## Done
RESULT COMPLETE — see MX1-web-multi-RESULT.md
- softKeep hoisted + joinPeers / party reflow waves
- multi-audio gated peerPcs.size ≥ 2
- live.js?v=572 pin
