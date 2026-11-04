---
title: PC Courtier freeze + Android 3-way split gone
date: 2026-08-15
source_type: screenshot
---

Human: PC Courtier cam frozen (not moving). Android cam still moves in little PiP. Then Android 2-screen 3-way split gone.

CDP 023400Z live.js 647 / webrtc 331 YOU Dragonov:
- #remote Courtier 320×427 tracks live+unmuted, currentTime **stuck 8.49→8.49** (FROZEN)
- #local Dragonov currentTime 129.09→130.32 (MOVING)
- teammate ice=disconnected cs=failed on #remote
- stranger ice=new, mid Partner no-cam, no tracks
- unique=2 leftover 3-col

Phone 023355Z APK 0.1.394:
- Full-stage no-cam Partner ★0 (1v1 tree)
- Small PiP = self ceiling cam (local preview)
- No top/bottom 3-way split (extraPeerCount=0, not hunting)

PiP moving ≠ RTP to PC. Local preview does not use the dead ICE path.
---
