# Second critic: Android answers=0 (read-only)

## Goal
Read-only RESULT for Grok at ~19:00: why Android stays `ice=new` / bind_v=0 while web offered. One next hop only.

## OWN
- `tasks/admin-queue/done/547-critic-answers-zero-RESULT.md` (write RESULT here)
- You may **read** `mobile/src/media/MediaSession.ts`, `ui/webrtc.js`, `ui/live.js`, `knowledge/wiki/gotchas.md` — **do not edit them**

## Cite
- 20:33Z shots + av-verify FAIL answers=0
- Gotcha 407 recvonly leftover vs this answers=0 (may be distinct)
- CONNECTIVITY_LOCK pool=0, do not cut 480, no force_relay=false

## Must not
- Any code edit
- deploy, APK
- Invent product.ok / MULTI_PASS

## Done
RESULT with: evidence, likely layer (A SDP / B bind / C encode), **exactly one NEXT_ROLE** (e.g. android-answer / web-offer / verify-only). COMPLETE
