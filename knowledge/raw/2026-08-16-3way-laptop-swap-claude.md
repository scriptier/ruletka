---
title: Claude critic — 3way laptop name/stream occupancy hop
date: 2026-08-16
slug: 3way-laptop-swap-claude
source_type: note
captured_by: agent
skill: claude-worker
herd: 20260816T064603Z
lane: d-claude
---

# Raw: Claude second critic (read-only)

**Spec:** `knowledge/specs/2026-08-16-laptop-two-videos.md`  
**Shots:** `knowledge/raw/2026-08-16-3way-laptop-swap-shots.md` · `064538Z`  
**Read:** `pickFirstPartnerPeer` · `pickExtraRemotePeer` · `paintTrioTileNames` · `syncLaptopTrioTiles` · `bindSoloPartyBothRemotes` in `ui/live.js`  
**Must not:** edit `ui/live.js` or `MediaSession.ts`

## Verdict

**AGREE** the hop is occupancy bind **name+stream** in `ui/live.js` only. No remount. No MediaSession. No APK this hop.

Occupancy helpers already exist. They still **diverge** from name paint and a later rebind. That is the laptop FAIL. Do not open ICE / remount / APK.

## Human FAIL vs disk

| Seat | Seen | Read |
|------|------|------|
| Laptop 3rd | Left **Courtier + wrong video**. Mid **Dragonov + correct video**. | Name and `srcObject` are different people on `#remote`. Mid occupancy is honest. |
| This PC `064538Z` | Left Laptop no-cam (ok). Mid Courtier no-cam **but phone has cam**. You Dragonov live. | Layout/role ok. Courtier stream not on mid (or no-cam cover). |
| Phone | Top Laptop mute black (ok-ish). Bottom Dragonov **Almost there** — no PC cam. Self PiP has cam. | Extra/primary receive not painted. Score leftover android **0**/2895 + extra `ice=new` bind_v=0. |

Score `064541Z`: leftover product.ok is **PC↔phone 1v1** (web 2975/2219). Android extra `ice=new` bind_v=0. answers 7 < offers 8. **Not** laptop two-videos PASS. **No MULTI_PASS.**

## Why occupancy bind (not remount / not MediaSession)

`pickFirstPartnerPeer` already prefers `liveMainRemotePc()` before latch. `bindSoloPartyBothRemotes` already binds by occupancy PC. `syncLaptopTrioTiles` already paints names from occupancy then strips a cloned `srcObject`.

Then other paths undo it:

1. **`paintAllRemoteIdentityChrome`** (after join / `bindLiveTrioRemoteTiles`) paints `#remote` from **`lastGoodPartnerName`**, not the occupant. Laptop left stays **Courtier** while the live occupant is Dragonov. Matches left Courtier + wrong video.
2. **`paintTrioTileNames`** still documents party convention (Left=Courtier, Mid=Laptop). On laptop `yourRole=solo` both remotes are party. Latch / list-order Courtier can win names when `liveMainRemotePc()` is null (no live AV on `#remote` yet).
3. **`bindLiveTrioRemoteTiles`** picks first via **`pcIsFirstPartner`** (teammate/latch), **not** occupancy. Called **after** `bindSoloPartyBothRemotes` (`joinPeers` ~32683–32695 and ~33407–33412). Then `bindPcVideo(main2, #remote)` rebinds `pickFirstPartnerPeer` onto left.
4. Same `srcObject` on two tiles is already stripped, but **name is not moved with the stream**. Mid can keep Dragonov (correct) while left keeps Courtier (lie).
5. PC mid Courtier no-cam while web **fin=2975**: inbound frames exist on the held pair. Occupancy put Laptop (no-cam) on `#remote`; Courtier stream was not rebound to `#remote-third` / no-cam was not peeled (`tileEverHadCamera` / gotcha 48). In-scope **if** that PC already has `remoteStream`.

Phone **Almost there** + android extra `ice=new` is **out of scope**. Paint cannot invent Courtier frames on laptop when the extra PC never left `new`. That is spec `2026-08-16-laptop-offer-android.md` + MediaSession extra reset — **parked, needs APK later**. Do not pull it into this hop.

## Hop scope

- One writer: `ui/live.js` (director cache-bust `live.js?v=` after).
- One bind: occupant PC’s **stream and name** on the same tile; the other listed peer on mid; never dual `srcObject`; never re-cover a tile that decoded pictures.
- Stop latch / `paintAllRemoteIdentityChrome` / `bindLiveTrioRemoteTiles` from renaming or rebinding across that pair after occupancy bind.
- EVAL: `node --check ui/live.js` · `node ui/live-third-slot.test.mjs` · re-grep `tileEverHadCamera` · occupancy trio name · no dual `srcObject`.
- **No** hunt remount. **No** `MediaSession.ts`. **No** APK. **No** `push.sh`. **No** pool>0. **No** invent MULTI_PASS / product.ok.

HOP=Bind occupancy PC name+srcObject on the same tile and put the other listed peer on mid; stop latch/paintAllRemoteIdentityChrome/bindLiveTrioRemoteTiles from swapping them; peel no-cam if frames exist; no remount, MediaSession, or APK.

AGREE=yes
HOP=Bind occupancy PC name+srcObject on the same tile and put the other listed peer on mid; stop latch/paintAllRemoteIdentityChrome/bindLiveTrioRemoteTiles from swapping them; peel no-cam if frames exist; no remount, MediaSession, or APK.
OWN=ui/live.js
GOAL_MET=yes
