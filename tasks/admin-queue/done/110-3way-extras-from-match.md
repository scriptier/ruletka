# 3-way extras still listed when hub has 2 remotes

## Goal
Android 2-screen 3-way split disappeared when extras list went empty. Harden `extraPeersFromMatch` so a hub Matched with **2 remotes** still returns the non-primary extra (Laptop). 1 unique remote → empty extras (1v1 lock).

## OWN
- `mobile/src/live/matchPeers.ts`
- `mobile/src/live/matchPeers.test.mjs` (or existing extras tests in that file)

## Must not
- `MediaSession.ts`, `ui/live.js`, `ui/webrtc.js`
- startCall / closeCall / ICE / force_relay / pool>0
- APK, deploy, git push
- Invent MULTI_PASS / product.ok

## Done
- `extraPeersFromMatch(msg, primaryId)` returns the other peer when `msg.peers` has 2 remotes
- 1 peer / empty / poison primary-only → `[]`
- Tests pass: `node mobile/src/live/matchPeers.test.mjs`
- RESULT markdown + COMPLETE
