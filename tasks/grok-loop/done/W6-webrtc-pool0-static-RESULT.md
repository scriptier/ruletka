# W6-webrtc-pool0-static — RESULT

**Status:** COMPLETE  
**OWN:** `ui/webrtc.js` read-only  
**Date:** 2026-08-12T02:05:07Z  
**Syntax:** `node --check ui/webrtc.js` → **PASS** (exit 0)  
**Code change:** none (static recheck only; no regression)

## Goal
Confirm pool=0 and hop9 pure 520 / warm 350 still on disk. No ICE thrash.

## Checks

### 1. pool=0 — PASS
| Item | Location | Verdict |
|------|----------|---------|
| `ICE_CANDIDATE_POOL_SIZE = 0` | L17 | PASS |
| `ICE_RELAY_POOL_SIZE = 0` | L19 | PASS |
| `DEFAULT_ICE.iceCandidatePoolSize` → constant | L27 | PASS |
| hide_ip / force_relay / normal: `poolSize = 0` | `applyIceDirectPreference` L519–560 | PASS |
| warm pure: `iceCandidatePoolSize: 0` | `warmIcePool` L714 | PASS |
| warm hybrid: `ICE_CANDIDATE_POOL_SIZE` (0) | L728 | PASS |
| No assignment pool ≥1 | grep `iceCandidatePoolSize\s*[:=]\s*[1-9]` / `poolSize\s*=\s*[1-9]` | **0 hits** PASS |

LOCK comment L14–15 still present: pool≥2 caused ALLOCATE storms + 437 + peer_usage≈0.

### 2. hop9 pure 520 / warm 350 — PASS
| Item | Location | Verdict |
|------|----------|---------|
| Pure first-relay budget **520** | `relayWaitBudgetMs` L317–318 | PASS |
| Hybrid first-pass **320** | L319–320 | PASS |
| Offer warm first-pass `min(budget, 350)` | `_createAndSendOffer` L2825–2827 | PASS |
| Offer pure cold = budget (**520**) | same | PASS |
| Offer multiFast cold cap `min(wait1, 450)` | L2828 | PASS |
| Offer second wait: pure cold **350** / warm **300** / multi cold **300** / hybrid **300** | L2840–2852 | PASS |
| Answer same hop9 schedule (cold 520 / warm first 350) | L3446–3477 | PASS |
| Early-exit on first `typ relay` | `waitForIceGatherRelayOrDone` both paths | PASS |
| Pure rebuild-if-n=0 belt (offer only) | L2864+ | PASS |

### 3. multiFast present — PASS
- `isMultiPeerFastMode(this)` used on offer (L2823) and answer (L3451)
- Caps cold multi only (≤450 first pass / 300 second); does not lengthen 1v1 pure budgets

### 4. No ICE thrash — PASS
| Guard | Location | Verdict |
|-------|----------|---------|
| HARD CAP: ≤1 iceRestart offer per match once remote SDP | `_tryIceRestart` L3056–3060 | PASS |
| Skip while ICE still `checking`/`new` | L3062–3071 | PASS |
| Grace: earlyBlack 18s / force 18s / remote 25s / else 12s | L3074–3085 | PASS |
| Rate limit 5s in-flight / 8s between | L3087–3088 | PASS |
| Offer path skips renego thrash unless `iceRestart` | L2626–2737 | PASS |
| First 18s soft path: keyframes only, never iceRestart | L3220 comment | PASS |
| Warm: keep same-policy PC (no multi-ALLOCATE) | L733–736 | PASS |
| Hybrid warm: PC object only, pool=0 forever | L789–790 | PASS |

## Fix
None. No regression vs prior hop9 + pool=0 lock (P0-webrtc-multi-recheck). Contracts still match:
- AGENTS hard wall: never `iceCandidatePoolSize` > 0
- hop9 link budgets: pure cold 520 / warm first 350

## Must-not confirmed
- **pool>0:** none on disk
- **ICE thrash:** restart hard-capped + grace; no pool pre-ALLOCATE storms

## Not done (by job scope)
- No deploy / no APK
- No live.js / CSS / mobile edits
- No human smoke / av-verify product.ok claim

## Job complete
Running job → done; RESULT filed. Read-only; zero file edits to `ui/webrtc.js`.
