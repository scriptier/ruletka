# MX3-webrtc-multi — RESULT

**Status:** COMPLETE  
**OWN:** `ui/webrtc.js` only  
**Spec:** `knowledge/specs/MULTI-CROSS-IMPROVE-PLAN.md` **P3** · skill `multi-party-stage`  
**Date:** 2026-08-12  
**Syntax:** `node --check ui/webrtc.js` → **PASS** (exit 0)  
**Code change:** none (audit; contracts intact — no gap requiring fix)  
**Cache:** `webrtc.js?v=315` unchanged (no bump without edit)

## Goal

Audit multi/Android clone safety, mobile multi quality floor **low** not **min**, `setLocalStream` not killing multi clones. Minimal fix if gap.

## Checks

### 1. setLocalStream does not kill multi clones — PASS

| Item | Location | Verdict |
|------|----------|---------|
| `setLocalStream` does **not** stop previous tracks | ~1576–1578 | PASS — comment + assign only; preview/clones owned by live.js |
| `syncLocalTracksToPc` / `replaceTrack` never stops prev | ~1626–1627 | PASS — “prev may be preview real track or multi clone — never stop here” |
| `startLocalMedia` old tracks only via `stopTrackUnlessPreview` | ~1512–1515 | PASS |
| `trackBelongsToPreview` / `stopTrackUnlessPreview` | ~1124–1146 | PASS — shared preview never stopped |
| Mic/cam toggles only touch `this.localStream` | ~1644–1665 | PASS — no preview-by-id thrash |

### 2. closeCall keepLocal + clone release — PASS

| Item | Location | Verdict |
|------|----------|---------|
| `closeCall` **always** calls `window.__ruletReleasePeerOutbound(this)` | ~3754–3761 | PASS — before keepLocal branch; releases multi clones not preview |
| `keepLocal:true` never stops local tracks | ~3763–3780 | PASS — preview stays for rematch / multi |
| `keepLocal:false` stops only non-preview tracks | ~3763–3778 | PASS — `stopTrackUnlessPreview` |
| live.js wires `__ruletReleasePeerOutbound = releasePeerOutboundVideoClone` | live.js ~18155–18157 (read-only) | PASS |

### 3. Mobile multi quality floor low not min — PASS

| Item | Location | Verdict |
|------|----------|---------|
| `mobileSafeMultiTier`: Android multi `min` → `low` | ~1150–1160 | PASS |
| Wired in `setQualityCeiling` | ~1461–1465 | PASS — ceiling never stuck at min on Android multi |
| Wired in `applyQualityTier` | ~1672–1674 | PASS |
| Wired in adaptive `_adaptOnce` | ~1817–1818 | PASS — adaptive cannot land on min on Android multi |
| multiFast gate: `_multiPeerLink` / `__ruletMultiPeerFast` | `isMultiPeerFastMode` ~1097–1105 | PASS |
| QUALITY_TIERS ladder intact (high/mid/low/min) | ~1045–1070 | PASS — desktop 1v1 still has min |

### 4. multiFast gather (no 1v1 budget lengthen) — PASS

| Item | Location | Verdict |
|------|----------|---------|
| Offer cold multiFast first-wait cap `min(wait1, 450)` | ~2822–2828 | PASS |
| Answer same multiFast schedule | ~3450–3454 | PASS |
| pool=0 locked | `ICE_CANDIDATE_POOL_SIZE=0` · all `poolSize=0` paths | PASS |
| No `iceCandidatePoolSize` / `poolSize` ≥1 assignment | grep | PASS (0 hits) |

## Fix

None. Surgical change not required — multi safety contracts already present and consistent with:

- `MULTI-CROSS-IMPROVE-PLAN` P3 (setLocalStream no clone kill; mobile multi floor low)
- `multi-party-stage` media table (Android min→low; preview stop guards)
- gotchas **20–21** (no shared-track kill path in webrtc; floor low not min)
- AGENTS hard wall: never `iceCandidatePoolSize` > 0

## Residual (not this lane)

| Item | Owner |
|------|--------|
| Secondary always `track.clone()` / no audio `setLocalStream(preview)` | MX1 `live.js` |
| Android `adoptLocalStream` / secondary keepLocal | MX2 MediaSession |
| Human 3/4-way faces smoke | human — **no invent PASS** |

## Not done (by job scope)

- No deploy / no APK  
- No edits to `live.js` / MediaSession / CSS  
- No human multi product PASS claim  
- No pool thrash  

## Job complete

Moved running → done; RESULT filed.
