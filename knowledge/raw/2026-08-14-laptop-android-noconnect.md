---
title: Laptop ↔ Android not linking
date: 2026-08-14
slug: laptop-android-noconnect
source_type: screenshot
source_path: artifacts/shots/20260814T034204Z-noconnect-lap-phone.png
captured_by: agent
---

# Raw: laptop ↔ Android no-media — 2026-08-14T03:42Z

**product.no-media** · **NO product.ok invent**

## Shots `20260814T034204Z-noconnect-lap`

- Phone: matched **0:48**, partner tile **BLACK**, name **Partner**, local cam live
- Desk PC: Chrome + Firefox both **idle Start** (not the laptop)

## Score `20260814T034227Z`

| Field | Value |
|-------|--------|
| product | no-media · web 0/0 · android 0/0 |
| last match | **web↔web** force_relay=false (desk tab stole laptop) |
| android (prior) | ice=**failed** · fr=1 · policy=relay · bind_v=1 · hub_fr=1 · zero_f_45000 |
| signaling | 7/7 offers/answers |
| TURN | HOT max_rb=598312 peer_hot=15 err_437=1 |
| APK | 0.1.376 / vc384 |
| earlier 03:15 | web↔android fr=true · android ice=new bind_v=0 · answer relay_candidates **0** |

Morning same-desk 1v1 product.ok `025100Z` 1097/2153 ≠ this laptop hop.

## Diagnosis

1. Extra live.html tabs on the **desk** entered the solo queue → laptop matched a browser, not the phone.
2. Phone ICE **failed** on pure relay (same-LAN force_relay) after 45s zero frames.
3. Do not thrash coturn (media HOT). Do not invent product.ok.
