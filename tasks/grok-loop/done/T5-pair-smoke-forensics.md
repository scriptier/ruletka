# T5 local pair-smoke wire 0/0 forensics

## Goal
RESULT-only root cause note for pair-smoke FAIL (0 wire offer/answer, force_relay thrash). No product ICE rewrite.

## OWN
Read logs /tmp/t2-pair-smoke-rematch.log + scripts/pair-smoke.mjs + ui/webrtc.js comments only if needed. RESULT COMPLETE.

## Work
1. Quote why wsOut offer never fires (TURN=off fail-open thrash).
2. Note phone MATCHED is separate.
3. Must not: deploy, pool>0, dual MediaSession, force-push, product thrash fix.
