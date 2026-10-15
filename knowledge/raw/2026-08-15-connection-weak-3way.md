---
title: Connection weak on same-desk 3-way + Courtier cam + laptop 1 video
date: 2026-08-15
source_type: screenshot
---

Human: 3 devices beside each other, good internet. Banner "Connection weak — reconnecting". Courtier webcam crashed on PC. Laptop does not see 2 videos.

CDP 022245Z live 646:
- YOU Dragonov 3-col
- #remote Courtier 320×427 live tracks; teammate ice=disconnected cs=failed (frozen last frame after phone CaptureThread crash)
- #remote-third Partner no tracks; stranger ice=new
- strip Connection weak (false: one extra never connected / first ICE label failed)

Phone 394: still 1v1 no-cam Partner.

Cause: global ICE disconnected handler + canShowReconnectingMediaUx after first frames. Soft-recover allowed on teammate when size>1 → Courtier cam tear.

Hop 647: no stage Weak if 2 unique PCs and any remote still painting; never soft-recover first partner. Extra ice=new / laptop 2 videos OPEN. webrtc 331 untouched.
---
