# MX1-web-multi-clone-softkeep — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` only (+ `ui/live.html` cache pin)  
**Date:** 2026-08-12  
**Pin:** `live.js?v=572` (was 571)  
**Deploy:** no (pin only)  
**Multi PASS:** not claimed — human smoke open

## Goal
Harden PC/browser multi so Android peers don't freeze on find-3rd / 3-way join.

## Audit (file:line)

### 1. Secondary always clone — **PASS (pre-existing)**

| Symbol | Location | Verdict |
|--------|----------|---------|
| `ensureOutboundVideoClone` | `ui/live.js` ~18215–18240 | `real.clone()` → `pc._outboundVidClone`; fallback real |
| `outboundVideoTrackForPc` | ~18250–18262 | solo → real; multi primary → real; **non-primary always clone** |
| `pushOutboundVideoTracks` | ~18420+ | multi: `outboundVideoTrackForPc(pc, real)`; no `setLocalStream(preview)` on secondaries |
| `pickPrimaryPeerPc` | ~18189–18196 | teammate preferred primary keeps real for `#local` |
| joinPeers bind | ~27790+ | map register first, then `outboundVideoTrackForPc`; multi uses per-PC MediaStream |
| kickSolo bind | ~27080+ | same clone-or-real; multi without tracks leaves empty for later push |
| Audio push | `pushOutboundAudioTracks` ~17995+ | audio-only `replaceTrack` — **never** `setLocalStream(preview)` |

### 2. softKeep + find-3rd / Android join — **GAP fixed**

| Item | Before | After |
|------|--------|-------|
| `softKeepPartnerPaint` | local-only inside `handleFindThirdResult` | **hoisted** ~13123–13163 |
| Waves 0/80/250/700/1500 | find-third accept only | `scheduleSoftKeepPartnerPaint` ~13166–13170 |
| find-third accept | local softKeep | `scheduleSoftKeepPartnerPaint()` ~33336 |
| **Android 3rd join / joinPeers reflow** | single `ensurePartnerVideoVisible` only | **softKeep after joinPeers** when trio party or multi ~27997–28008 |
| party_browse Matched reflow | soft() 0/100/400 only | + `scheduleSoftKeepPartnerPaint()` ~25859 |

Soft keep contract: soft re-play + optional `requestKeyFrame` + Courtier latch; **no** hard `#remote` null-rebind.

### 3. Multi-audio / quality gate — **GAP fixed (audio); quality OK**

| Gate | Location | Verdict |
|------|----------|---------|
| `applyMultiPeerOutboundQuality` | ~26472+ | early-return when `live.length <= 1`; mobile floor **low** not min | **PASS** |
| joinPeers quality | after connectJobs | only applies with live PCs | **PASS** |
| `isMultiPeerAudioFromMatch` | ~21053–21068 | **was:** teammate+stranger list or `trioBrowse && opponents≥1` could fire with **1 PC** | **fixed:** hard gate `peerPcs.size < 2 && count < 2 → false` |
| `enterMultiPeerAudioMode` | ~21154–21158 | **was:** peer-list true bypassed size | **fixed:** `if (peerPcs.size < 2) return` |

## Code changes (minimal)

1. **Hoist** `softKeepPartnerPaint` + `scheduleSoftKeepPartnerPaint` (shared waves).
2. **Call softKeep** after `joinPeers` layout reflow (Android peer join / 3rd fill) and party_browse Matched soft path.
3. **Tighten multi-audio** to real multi only (`peerPcs.size ≥ 2`).
4. **Pin** `live.js?v=572` in `ui/live.html` (preload + script).

## Residual

| Residual | Owner / next |
|----------|----------------|
| Human find-3rd ≥30s partner-moving smoke | human / MX5 smoke matrix |
| Android remount / multi-audio on app | MX2 (`MediaSession` / `live.tsx`) |
| webrtc setLocalStream clone safety | MX3 (`webrtc.js`) |
| Layout orphan tiles | MX4 (CSS) |
| Deploy prod | human authorize overnight |

## Must not (honored)

- No MediaSession thrash  
- No SoftBlur product thrash  
- No pool>0 / ICE thrash  
- No invent multi PASS  
- No deploy  

## Job complete

- RESULT: `tasks/grok-loop/done/MX1-web-multi-RESULT.md`  
- Card: `backlog/MX1-web-multi-clone-softkeep.md` → `done/`
