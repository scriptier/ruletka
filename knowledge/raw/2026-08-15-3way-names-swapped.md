---
title: 3-way names swapped (Laptop on left, Partner on mid)
date: 2026-08-15
source_type: image
source_path: artifacts/shots/20260815T015545Z-3way-names-pc.png
---

Human: 3-way connected (slower than 1v1). Left tile labeled Laptop — that name belongs on the middle no-cam tile. Mid says Partner; should be Laptop. Left should be Courtier (first conversationalist).

PC shot `20260815T015545Z-3way-names-pc.png`:
- Left: live cam (phone/ceiling) name **Laptop** · Canada Calgary
- Mid: no-cam cylinder name **Partner** ★36
- Right: YOU Dragonov
- Banner: You + friend — stranger on the right
- Pins in page: live 645 / webrtc 331 (before name hop)

Phone shot `20260815T015545Z-3way-names-phone.png`:
- Settings overlay open; still 1v1-style **Partner** + no-cam portrait
- Not the PC name-swap; extras identity still APK-gated

Cause (code): hub lists stranger first → opponents[0] Laptop painted on #remote + latched; joinPeers add passed hex addIds into extraSlotDisplayName → mid "Partner".
