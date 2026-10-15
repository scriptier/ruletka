---
title: Laptop 3-way should show 2 videos — shows 0
date: 2026-08-15
slug: laptop-3way-zero-videos
source_type: screenshot
source_url:
source_path: artifacts/shots/20260815T233542Z-laptop-3way.jpg
captured_by: human
skill: add-new-resource
binary_inlined: false
---

# Raw: Laptop 3-way should show 2 videos

## Source
- Type: screenshot + CDP PC capture + av-verify
- Human laptop: `/home/drakosik/Downloads/photo_2026-08-15_17-33-58.jpg` copied to `artifacts/shots/20260815T233542Z-laptop-3way.jpg`
- Agent PC: `artifacts/shots/20260815T233542Z-pc-3way.png`
- Score: `20260815T233602Z`
- Captured: 2026-08-15

## Original

User: i saved a new screenshot how laptop looks like 3way and take a new screenshot how pc looks like 3 way. laptop should see 2 videos

### Laptop (human, 17:33)

3-col · YOU **Laptop** MATCHED · chip **You · vs a pair (two videos)**
- Left **Courtier** ★133 **black** (Canada Calgary, NEW, praised by 4)
- Mid **Partner** ★1 no-cam cylinder “Talking with microphone”
- Right **YOU Laptop** ★41 no-cam cylinder “You're on microphone” (honest — laptop has no webcam)

**Zero live cameras.** Should be Courtier (phone) + Dragonov (this PC).

### This PC (CDP 233542Z, pins 656/331)

3-col · YOU **Dragonov** · chip **You + friend · stranger on the right** · Connecting…
- Left **Courtier** ★133 **live phone cam** (ceiling + head) · remote 320×427
- Mid **Partner** ★41 no-cam cylinder (laptop — correct)
- Right **YOU Dragonov** live

`#remote-name=Courtier` · `#third-tag=Partner` · `#local-name=Dragonov`

### av-verify `233602Z` (8 min)

Headline PASS product **ok** app_vc **421** web 6016/6672 android 6772/6123.
Clients in beacons: **only** `ba2b8e5a` web + `5bc3ba39` android.
Android 2nd PC still ice=**failed** 0/0.
**No laptop web id** in this window.
product.ok = PC↔phone 1v1. **No MULTI_PASS.**

Phone adb: no permissions this turn (empty stub deleted).
