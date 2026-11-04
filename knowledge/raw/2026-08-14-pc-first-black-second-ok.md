---
title: PC first match Courtier black, second connect painted
date: 2026-08-14
slug: pc-first-black-second-ok
source_type: screenshot
source_url:
source_path: artifacts/shots/20260814T214314Z-novid-pc-ruletka.png
captured_by: agent
skill: add-new-resource
binary_inlined: false
---

# Raw: PC first-fail / second-ok inbound paint

## Source
- Type: screenshot + av-verify
- Path: `artifacts/shots/`
- Captured: 2026-08-14

## Original

Human: "again not showing camera video on pc browser" then "okay it connected second time".

### First fail `214314Z` (novid)

- `artifacts/shots/20260814T214314Z-novid-pc-ruletka.png` — 1v1 2-col, Courtier **black** + mute glyph, you live
- `…-novid-phone.png` — phone sees PC face (Драконов)
- av-verify `20260814T214344Z` **WARN** answers 5 < offers 6 · **product.status=ok** web fin/fout 980/1242 · android 1224/977 · ice connected · relay · app_vc **400**

### Second connect `214534Z`

- `artifacts/shots/20260814T214534Z-second-ok-pc.png` — Courtier **live** (indoor wall), you live, mute glyph still on partner (audio), title "Connecting…"
- `…-second-ok-phone.png` — phone idle/hunt brand cylinder + "Finding a 3rd together…" + Start (not the same 1v1 paint as PC)
- av-verify `20260814T214540Z` **WARN** answers 4 < offers 5 · **product.status=ok** web 469/622 · android 607/465 · app_vc **400**

## Description (for search without opening binary)

- First match: SDP/frames OK, PC inbound **UI black** (phone sees PC)
- Rematch: PC inbound **painted**
- Diagnosis: paint/overlay latch, not ICE. Inbound `track.muted` until first RTP treated as audio-only → `#remote-no-cam` + CSS `#remote-no-cam[hidden] { display:flex; z-index:9 }` covered `#remote`

Do not invent GOAL_MET. Disk hop `live.js?v=627` · `live-stage.css?v=442` — **needs rsync** (human proceed). Prod last 625/440.
