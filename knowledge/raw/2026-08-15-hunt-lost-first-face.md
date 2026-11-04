---
title: Hunt for 3rd lost first face after 400 1v1
date: 2026-08-15
slug: hunt-lost-first-face
source_type: screenshot
source_url:
source_path: artifacts/shots/20260815T052135Z-hunt3rd-phone.png
captured_by: agent
skill: add-new-resource
binary_inlined: false
---

# Raw: Hunt for 3rd lost first face after 400 1v1

## Source
- Type: screenshot + CDP + av-verify + human paste
- Paths:
  - `artifacts/shots/20260815T052135Z-hunt3rd-phone.png`
  - `artifacts/shots/20260815T052135Z-hunt3rd-pc.png`
  - `artifacts/shots/20260815T052326Z-hunt3rd-cdp1.png`
  - `artifacts/shots/20260815T052326Z-hunt3rd-cdp2.png`
  - `artifacts/shots/20260815T052326Z-hunt3rd-cdp.json`
  - `artifacts/av-verify/latest.json` stamp `20260815T052139Z`
- Captured: 2026-08-15

## Human (untouched)

okay you fixed 1v1 but as soon as we try to go 3 way camera freezes for pc browser but on android camera works for user but he already lost video of first conversationalist after we started looking for 3rd one

## Description (shots)

- Phone 052135Z: idle Start. 0 online. LAST CHAT Partner 9m. Self PiP ceiling. Not in hunt.
- PC desktop 052135Z: Grok TUI + VLC, not the live tab.
- CDP 052326Z both ruletka.me live.html tabs: idle Start, YOU Dragonov local 854×480 live, #remote empty, #tile-third hidden, body stage-body, no trio.
- av-verify 052139Z: leftover 1v1 product.ok app_vc=408 web 176/169 android 160/174. NOT hunt PASS.

## Herd diagnose 20260815T052415Z (not product)

- hunt-android-layout: `splitStage = huntingThird || multiRemote` restyles first tile to overflow:hidden → SurfaceView tear.
- hunt-android-live: enterHunting does not startCall/wipe/multi-audio; lookingForThird prop is what flips the wrap.
- hunt-web: handleFindThirdResult already stays 2-col; enableTrioLayout searching coerced off. PC freeze = Android outbound from remount.

## Original

Binary not inlined. Open source_path. Do not invent MULTI_PASS.
