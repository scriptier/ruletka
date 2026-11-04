# 2026-08-14 — 3-way laptop sees PC camera, not Android

**Status:** diagnosed + disk hop `live.js?v=590` · **no MULTI_PASS** · needs human rsync + 3-way smoke

## Human

Laptop Chrome 3-way: tiles present. **PC camera paints. Android camera does not.**
1v1 laptop↔PC and laptop↔Android (webrtc 322 + APK 384) had already linked.

## Score (`20260814T063259Z`)

- verdict **WARN** · product **one-way** (av-verify 1v1 parser; 3-way not product.ok)
- answers 5 < offers 6
- **b16a30da** laptop web: offerer=0 → PC ice=connected frames_in climbing; offerer=1 → Android ice=disconnected/failed frames_in **stuck 124**, then ice=new `have-local-offer`
- **8611cc20** PC web: offerer=1 ice=connected frames_out climbing (PC cam)
- **f889660d** android: ice=new bind_v=0 arm_0
- Hub: `party vs solo matched (1v2) solo=8611cc20 a=b16a30da` (PC = 3rd, pair = laptop+Android)

## Cause

`handleMatched` keep-PC used `peers[0]` (hub stranger-first) + `needNewPeer` + old `forceFlip = msg.force_relay && !live`. 3rd-join Matched always listed the new PC first (no PC yet) with same-LAN `force_relay` → **full rematch**: reset frames, `startWebrtcWatch`, `joinPeers` tore teammate on ice=disconnected blip and re-offered. Hub **per-client** offer debounce 3.5s drops the second offer → have-local-offer loop, Android tile black.

## Disk hop

`ui/live.js?v=590`: if already matched + at least one live listed PC + new peer + no real force_relay policy flip → `joinPeers` only (keep teammate). `joinPeers` tears listed PCs only when ice=closed.

## Not claimed

MULTI_PASS · GOAL_MET · product.ok. Phone APK unchanged (384/392).
