---
title: 1v1 ICE failed — leftover relay + m-line answer
date: 2026-08-15
slug: 1v1-mlines-leftover-relay
source_type: note
captured_by: agent
skill: add-new-resource
---

# Raw: 1v1 ICE failed (004415Z / 004600Z)

## Evidence
- Shots `004321Z` Linking + phone no-cam; `004600Z` phone **black** (not cylinder) + PC Linking + DevTools
- Score `004415Z`/`004606Z` product **no-media** 0/0 both ways. ice **failed**. policy **all**. hub_fr **false**. offer relay=1 answer relay=**0**. mto 6949 mta 7842. app_vc 400
- Console (debug tab 635/329): `answer apply failed` InvalidModificationError **order of m-lines**; `no local camera = audio-only preview`; `offer first-relay`; `soft recover skipped — match grace`

## Cause
1. 3-way left `sessionForceRelay=true`. Incremental Matched keep (`huntKeepPc` even on ice=failed) never cleared it. Next 1v1: web relay-only vs Android hybrid answer with **0** relay → ICE failed.
2. 329 `_promoteVideoSend` re-offered when `stable` before first answer latch was safe; second offer + first answer → m-line InvalidModification.

## Hop
live.js **636** · webrtc **330** rsync 1v1 leftover-relay + no pre-answer promote renego.
**Needs hard-refresh + rematch.** No product.ok invent.
