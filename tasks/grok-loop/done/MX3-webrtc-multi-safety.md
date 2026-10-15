# MX3: webrtc.js multi safety

## Goal
setLocalStream / replaceTrack / multiFast / closeCall keepLocal safe for multi clones.

## OWN
- `ui/webrtc.js` ONLY
- RESULT: tasks/grok-loop/done/MX3-webrtc-multi-RESULT.md

## Do
1. Audit multi / Android paths for shared track stop
2. mobileSafeMultiTier / min→low floor
3. Minimal fix if gap
4. Bump webrtc.js?v= if change

## Must not
live.js dual thrash, pool>0, invent PASS

## Done
RESULT COMPLETE — see MX3-webrtc-multi-RESULT.md (audit; no code gap; no v bump)
