# P0-webrtc-multi-recheck — RESULT

**Status:** COMPLETE  
**OWN:** `ui/webrtc.js` only  
**Date:** 2026-08-11  
**Syntax:** `node --check ui/webrtc.js` → **PASS** (exit 0)  
**Code change:** none (verify-only; contracts intact)

## Goal
Verify hop9 budgets + clone release + pool=0 in webrtc.js.

## Checks

### 1. hop9 budgets — PASS
| Item | Location | Verdict |
|------|----------|---------|
| Pure first-relay budget **520** (was 600 hop8) | `relayWaitBudgetMs` ~317–318 | PASS |
| Hybrid first-pass **320** | `relayWaitBudgetMs` ~319–320 | PASS |
| Offer warm first-pass `min(budget, 350)` | `_createAndSendOffer` ~2825–2827 | PASS |
| Offer pure cold = budget (**520**) | same | PASS |
| Offer multiFast cold cap `min(wait1, 450)` | ~2828 | PASS |
| Offer second wait: pure cold **350** / warm **300** / multi cold **300** / hybrid **300** | ~2840–2852 | PASS |
| Answer same schedule as offer (hop9) | answer path ~3446–3477 | PASS |
| Early-exit on first `typ relay` | `waitForIceGatherRelayOrDone` (used both paths) | PASS |
| Pure rebuild-if-n=0 belt stays (offer only) | ~2864–2892 | PASS |
| Answer has no rebuild (fail-open strip only) | answer path ends after second wait | PASS |

### 2. pool=0 — PASS
| Item | Location | Verdict |
|------|----------|---------|
| `ICE_CANDIDATE_POOL_SIZE = 0` | ~17 | PASS |
| `ICE_RELAY_POOL_SIZE = 0` | ~19 | PASS |
| `DEFAULT_ICE.iceCandidatePoolSize` uses constant | ~27 | PASS |
| force_relay / hide_ip / normal all set `poolSize = 0` | `applyIceDirectPreference` ~519–560 | PASS |
| warm pure: `iceCandidatePoolSize: 0` | `warmIcePool` ~714 | PASS |
| warm hybrid: `ICE_CANDIDATE_POOL_SIZE` (0) | ~728 | PASS |
| **No** assignment of pool size ≥1 anywhere in file | grep `iceCandidatePoolSize\s*[:=]\s*[1-9]` / `poolSize\s*=\s*[1-9]` | PASS (0 hits) |

### 3. Multi clone release — PASS
| Item | Location | Verdict |
|------|----------|---------|
| `closeCall` **always** calls `window.__ruletReleasePeerOutbound(this)` (before keepLocal branch) | ~3754–3761 | PASS |
| `keepLocal:true` still releases multi clones; does not stop preview tracks | ~3763–3780 | PASS |
| `stopTrackUnlessPreview` / `trackBelongsToPreview` guard shared preview | ~1124–1146 | PASS |
| `setLocalStream` does **not** stop previous tracks (preview / multi clones owned by live.js) | ~1576–1578 | PASS |
| `replaceTrack` never stops prev (preview or clone) | ~1626–1627 | PASS |
| `startLocalMedia` stops old tracks only via `stopTrackUnlessPreview` | ~1512–1515 | PASS |
| multiFast flag: `_multiPeerLink` / `__ruletMultiPeerFast` | `isMultiPeerFastMode` ~1097–1105 | PASS |
| live.js side: `__ruletReleasePeerOutbound = releasePeerOutboundVideoClone` | live.js ~17884–17885 (read-only confirm) | PASS |

## Fix
None. Surgical fix not required — hop9 + pool=0 + multi release contracts present and consistent with:
- `knowledge/specs/current-linking-speed.md` (hop9 link-web-relay)
- `knowledge/specs/current-multi-party.md` (lane multi-webrtc)
- AGENTS hard wall: never `iceCandidatePoolSize` > 0

## Not done (by job scope)
- No deploy / no APK
- No edits to `live.js` / CSS / mobile
- No human smoke / av-verify product.ok claim

## Job complete
Moved running job → done; RESULT filed.
