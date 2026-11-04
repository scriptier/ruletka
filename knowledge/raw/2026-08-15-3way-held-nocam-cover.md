---
title: 3-way hunt-keep held — PC cam then no-cam cover; laptop misses Android
date: 2026-08-15
slug: 3way-held-nocam-cover
source_type: screenshot
source_url:
source_path: artifacts/shots/20260815T201649Z-3way-smoke2-phone.png
captured_by: agent
skill: add-new-resource
binary_inlined: false
---

# Raw: 3-way hunt-keep held — PC cam then no-cam cover

## Source
- Type: screenshot + human paste + av-verify
- Path: `artifacts/shots/20260815T201649Z-3way-smoke2-phone.png`
- Also: `artifacts/shots/20260815T201554Z-3way-smoke-pc-live.png`
- Recapture: `artifacts/shots/20260815T201933Z-3way-held-phone.png` (same phone FAIL; PC desktop already idle/Start)
- Score: `artifacts/av-verify/20260815T201602Z.json` · latest `20260815T202019Z`
- Captured: 2026-08-15

## Original (untouched)

Human (2026-08-15 ~20:16Z):

> on android when we went 3 way video didnt freeze and didnt disconect while we were searching for 3rd, when 3rd was connected pc browser is good, laptop browser was showing pc browser but for some reason not showing android camera, its strange because pc browser and laptop browser has exactly same version of chrome but one sees android cam and the other doesnt... on android it did flip to two screens, we still gotta teach it to auto rotate when phone is flipped but also i did see camera show up from pc browser on android but then it got covered by no camera picture right after lets fire up all agents to diagnose look in to all this take pictures on android phone and come up with plan to proceed next without breaking anything

## Phone 201649Z / 201933Z (same FAIL)

- Portrait two-stack (split worked).
- Top: Драконов ★205 + Laptop chip + Canada Calgary — **No camera · Talking with microphone · Драконов** covering the live PC tile the human saw first.
- Bottom: **No camera · Talking with microphone · Laptop** (correct — laptop has no webcam).
- PiP self cam live.
- App focused `me.ruletka.app/.MainActivity`. Serial `45141FDAP0004F`.

## PC 201554Z live crop

- 3-col: left **Laptop** black + mute icon (should be no-cam portrait, not void).
- Mid **Partner ★46** no-cam cylinder (Android cam covered or never bound).
- Right **YOU Драконов ★205** live. Mesh match · Relay Same Lan.

## av-verify 201602Z / 202019Z — leftover 1v1 product.ok ≠ 3-way PASS

- WARN answers 2 < offers 3
- last match web↔web force_relay
- PRODUCT ok leftover: web 7430–7539 / 8312 · android 8104 / 7409 · app_vc **412** bind_v=1
- Parsed beacons include: web ice=connected fout climbing fin=0; web ice=connected fin climbing fout=0 (laptop no-cam recv); **web ice=new 0/0** (the unanswered 3rd link)
- IDs in 201602Z window: android `31c76917` · web `27d2e4ab` (offerer mix) · web `53ddf52d`

## Do not invent

- MULTI_PASS
- product.ok as this 3-way
- Chrome-version theory (same Chrome; role / tile / unanswered offer)
