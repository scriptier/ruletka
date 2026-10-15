---
title: Laptop Chrome ↔ Android ICE failed after 379
date: 2026-08-14
slug: laptop-android-ice-closed
source_type: scorecard
source_path: artifacts/av-verify/latest.json
captured_by: agent
---

# Raw: laptop ↔ Android still no-media after 0.1.379

**product.no-media** · **NO product.ok invent**

## Score `20260814T052039Z`

| Field | Value |
|-------|--------|
| verdict | WARN |
| product | no-media · web 0/0 · android 0/0 |
| pair | android↔web force_relay=true |
| signaling | 4/4 matches offers answers · max_mto 1701 · max_mta 3158 |
| TURN | HOT max_rb=972698 peer_hot=16 err_437=0 |
| relay last offer/answer | **1/1** |
| android | ice=failed · policy=relay · fr=1 · bind_v=1 · app_vc=**387** |
| laptop pins | **prod** webrtc **316** / live **573** |
| disk pins | webrtc **319** / live **589** |

Desk PC idle (not in pair). Names+flags visible (hub Matched). No sound, no cams.

## Sequence (prior logcat)

ice=closed → recv offer → setRemote start → ice=closed → setRemote OK → createAnswer → setLocal → ice=checking → ~10s ice=failed.

1200ms answer wait landed (relay=1). ICE still dead.

## Hop (disk, this session)

1. Phone `MediaSession`: `dropDeadPc` / `isPcDead` — never setRemote on ice/signaling/connection=closed. startCall `pcBusy` ignores closed leftover. Offer path keeps queued trickle ICE.
2. Web `webrtc.js` **319**: offerer audio-only GUM still `addTransceiver("video")`.

Phone hop needs **APK**. Laptop hop needs **deploy** (laptop is on prod 316).

Do not invent product.ok.
