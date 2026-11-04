---
title: laptop-last 3-way score (413 / vc421)
date: 2026-08-15
slug: laptop-last-3way-score
source_type: note
source_url:
source_path: artifacts/shots/20260815T230857Z-android-laptop-last-pre.png
captured_by: agent
skill: add-new-resource
---

# Raw: laptop-last 3-way score

## Source
- Type: av-verify + CDP + adb screencap + PC CDP screenshot
- Captured: 2026-08-15
- Score: `20260815T230938Z`
- Phone shot: `artifacts/shots/20260815T230857Z-android-laptop-last-pre.png`
- PC shot: `artifacts/shots/20260815T230938Z-pc-laptop-last-3way.png`

## Original

User: proceed (laptop-last 3-way measure — laptop joins last so it offers to Android)

Pins: prod + disk + this-PC CDP all `live.js?v=656` · `webrtc.js?v=331` · stage `451`.
Phone: APK **0.1.413** versionCode **421** (`45141FDAP0004F`).
Laptop Chrome pin: **not inspected** (no CDP on laptop).

av-verify `20260815T230938Z` headline PASS product **ok** app_vc **421**:
- window 10 min: matches=8 offers=9 answers=9 (aggregate — includes leftover 413 1v1)
- TURN HOT max_rb=651453 err_437=0
- product.ok is **PC↔Android 1v1 pair**: web 4275/4763 · android 4704/4249 ice=connected bind_v=1

Three clients in window:
- `56ec365f` web **this PC / Dragonov** offerer=1
  - connected 4275/4763 (Android pair)
  - connected 0/3624 (laptop pair — sending cam, receiving no video)
- `80a459de` web **laptop** offerer=0
  - **one** beacon only: connected 3616/0 (sees this PC, fout=0 no webcam)
  - **no second PC** to Android
- `fc5bda95` android
  - connected 4704/4249 offerer=0 v_dir=sendrecv (this PC)
  - **ice=failed 0/0** offerer=0 sig=stable v_dir=sendrecv (laptop hop)

Phone UI 23:08: split top **Dragonov** live chair · bottom **Laptop** no-cam cylinder · self PiP live · 3:23. Cylinder is correct (laptop has no webcam).
This PC UI 23:09: 3-col · left **Laptop** ★133 **black** · mid **Partner** no-cam cylinder · right **YOU Dragonov** live · MATCHED · Relay Same Lan.

HISTORY tail still has leftover `video_dir=recvonly` from the 413 first 1v1 FAIL.

**No MULTI_PASS.** product.ok ≠ laptop sees Android. Laptop pin unverified.
