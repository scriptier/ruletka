---
title: Phone 3-way now — dual names on top tile, both cams black
date: 2026-08-19
slug: 3way-phone-dual-id-black
source_type: image
source_path: artifacts/shots/20260819T200600Z-phone-3way-now.png
captured_by: agent
skill: add-new-resource
---

# Raw: adb screencap 3-way on Pixel (APK 0.1.441)

Human: “take a screenshot of phone now thats how 3way looks like right now”

## Visual
- Split top/bottom exists (two black halves).
- Top identity stacked: **Laptop ★105** Canada Calgary **and** **Драгонов ★590** Canada Calgary.
- Both partner tiles **black**. PiP self cam live (ceiling).
- Speaker/mute chip on the midline right.

## Cause (agent)
Extra tile chrome `position:absolute` + VideoView `remoteFill` (absoluteFill) escaped the 50% tile because the tile was not `position: relative` / overflow hidden. Laptop name painted on the stage top over the primary dock. SurfaceViews filled the whole stage and stayed black.
---
