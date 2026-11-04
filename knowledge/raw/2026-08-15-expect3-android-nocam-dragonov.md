---
title: Expect3 — PC OK, Android Dragonov no-cam + Laptop connecting
date: 2026-08-15
slug: expect3-android-nocam-dragonov
source_type: screenshot
source_path: artifacts/shots/20260815T055528Z-expect3-phone.png
captured_by: agent
skill: add-new-resource
binary_inlined: false
---

# Raw: Expect3 contract vs shots

## Human
take screenshot on pc browser everything is as it should be, on android dragonov should be showing cam video and laptop should have no cam picture because laptop doesnt have a camera to share.

## Shots
- Phone: `artifacts/shots/20260815T055528Z-expect3-phone.png`
- CDP PC: `artifacts/shots/20260815T-expect3-cdp1.png`
- Desktop PC (Grok+VLC, not live): `artifacts/shots/20260815T055528Z-expect3-pc.png`
- CDP json: `artifacts/shots/20260815T-expect3-cdp.json`

## PC (CDP) — matches human “as it should be”
- 3-col: Courtier live ceiling | Laptop no-cam cylinder | YOU Dragonov Hide
- `#remote` 320×427 live video; `#remote-third` audio-only + `has-no-cam-portrait`; `#local` 854×480
- Banner You + friend · stranger on the right

## Phone — FAIL vs contract
- Top: Dragonov ★1 Canada · **No camera / Talking with microphone** (cylinder, not live cam)
- Bottom: Laptop ★41 · **Almost there...** (connecting, not no-cam)
- Self PiP ceiling (Courtier) live

## Contract
- Android first face = Dragonov **cam**
- Android 3rd tile = Laptop **no-cam picture** (honest, no camera to share)
- PC already correct

**No MULTI_PASS.**
