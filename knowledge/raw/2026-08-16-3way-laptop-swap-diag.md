---
title: Laptop 3-way Courtier/Dragonov name↔stream swap (064538Z / 064541Z)
date: 2026-08-16
slug: 3way-laptop-swap-diag
source_type: note
source_path: artifacts/av-verify/20260816T064541Z.json
captured_by: agent
skill: add-new-resource
lane: d-bind
---

# Raw: laptop 3-way swap diagnose (d-bind)

## Source
- Shots: `knowledge/raw/2026-08-16-3way-laptop-swap-shots.md` (`064538Z`)
- Score: `artifacts/av-verify/20260816T064541Z.json` / `latest.md`
- Spec: `knowledge/specs/2026-08-16-laptop-two-videos.md`
- Park: `knowledge/raw/2026-08-16-laptop-3rd-park.md`
- Prior same FAIL: `2026-08-16-laptop-double-pc-cam.md` · `laptop-courtier-pc-cam.md` · `laptop-console-remount.md`
- Code: `ui/live.js` `pickFirstPartnerPeer` · `pickExtraRemotePeer` · `syncLaptopTrioTiles` · `bindFirstPartnerToMain` · `bindSoloPartyBothRemotes`

## Human (064538Z)

- Laptop 3rd: left **Courtier + wrong video**; mid **Dragonov + correct video**. Self no-cam OK.
- This PC pair: left Laptop no-cam OK · mid Courtier no-cam **WRONG** (phone has cam) · you Dragonov live OK.
- Phone: top Laptop black/mute (OK) · bottom Dragonov **Almost there** (no PC cam).

## Score `064541Z` — leftover product.ok is not 3-way

- verdict WARN · product.status=`ok` · answers **7 < 8** offers · app_vc **425** · bind_v **0**
- web `0dc3f4ed` offerer=1 ice=connected **fin↑ fout=0** (two PCs: 2975/0 and 2231/0) = **laptop** recv-only
- web `c2122687` offerer=0 ice=connected **fin=0 fout↑** (2219) = **this PC → laptop**
- android `d2925f96` primary ice=connected bind_v=1 **fin=0 fout=2895** · extra ice=**new** bind_v=**0** 0/0
- Product web 2975/2219 is **laptop ↔ this PC**. android fin=0 = phone sees no inbound. Do **not** read phone_to_pc as Courtier on laptop.

**No MULTI_PASS. No invent product.ok for 3-way.**

## 5-line diagnosis

1. Only live inbound on laptop is **Dragonov** (`c2122687` fout → `0dc3f4ed` fin). Android extra never left `ice=new` — there is **no Courtier camera** to bind (gotcha **60**).
2. Left Courtier name is the **1v1 latch** + DC `skip-main (keep Courtier)` (console remount raw). `handleP2pDataMessage` refuses to steal main latch, then `paintPartnerIdentityChrome` keeps Courtier on `#remote` even when occupancy stream is Dragonov (gotcha **55**).
3. Mid Dragonov **correct** video is that one PC stream. Left **wrong** video is the **same** `srcObject` cloned onto `#remote` (gotcha **41**) and/or `bindFirstPartnerToMain` **`rekeyPeerPc(Courtier, DragonovPc)`** + `_role=teammate`, so `liveMainRemotePc` / `findPcForPeer` treat Dragonov media as Courtier.
4. `syncLaptopTrioTiles` names from occupancy-or-`pickFirstPartnerPeer` (latch wins after rekey) and only moves/dedupes streams — it does **not** pair name↔`srcObject` owner. `bindSoloPartyBothRemotes` then registers Courtier on `#remote` because occupancy PC was rekeyed.
5. This PC mid Courtier no-cam + phone Dragonov Almost there + android **fin=0** = pair inbound dead/unpainted after 3rd join; leftover product.ok is laptop←PC frames, not phone↔PC both ways (gotcha **59** leftover 1v1). Paint hop cannot invent Android frames.

## ONE recommended hop

**OWN:** `ui/live.js` only — `syncLaptopTrioTiles` (and solo guard in `bindFirstPartnerToMain`).

When `yourRole==="solo"`: name each remote tile from the **PC that owns that tile’s `srcObject`** (listed peer_id / `_displayName`). Never `paintPartnerIdentityChrome(lastGoodPartnerName)` / DC skip-main onto `#remote` if occupancy owner ≠ latch. Never `rekeyPeerPc` a live Dragonov PC under Courtier. If `#remote` and `#remote-third` share one stream, keep it on the owner’s tile and `srcObject=null` the other (do not cover a painting tile with no-cam).

This hop makes left name==stream (Dragonov + PC cam) and mid Courtier + connecting/no-cam until extra ICE exists. **Does not** paint phone cam (gotcha 60 — later offer hop).

## MUST NOT

- Edit `MediaSession.ts` / hunt remount / `iceCandidatePoolSize` / pool>0 / force_relay
- Dual-write `ui/live.js` / `ui/webrtc.js`
- APK / `push.sh` / invent MULTI_PASS or product.ok
- Offer/ICE thrash this hop (extra `ice=new` is a **next** hop, not this one)
- `setNoCamPortrait` over a tile with decoded pictures (`tileEverHadCamera`)

## Pins (disk; do not invent)

live.js **678** · webrtc **335** · stage **458** · APK **0.1.417 / vc425** (score app_vc 425)

GOAL_MET=yes
NEXT_OWN=ui/live.js
HOP=On laptop solo, pair each tile name to the PC that owns that srcObject and stop Courtier latch/rekey from labeling Dragonov’s stream.
