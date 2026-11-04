# CONN-HOP10-verify-docs — RESULT

**Status:** COMPLETE  
**OWN:** docs-only (`knowledge/wiki/linking-speed.md`, `knowledge/specs/CONNECT-IMPROVE-PLAN.md`, this RESULT)  
**Date:** 2026-08-12  
**Code change:** none (read `ui/live.js` / `ui/webrtc.js` only; no MediaSession / webrtc thrash / deploy)

## Goal

Verify hop10 web-kick on disk, confirm **pool=0** + no dual-offer thrash, stamp wiki + CONNECT plan. **No invent product.ok / GOAL_MET.**

## Disk verify (read-only)

### 1. `armOfferKickWatch` — hop10 inflightGrace

| Item | Location | State |
|------|----------|-------|
| Pure / force_relay grace | `ui/live.js` ~10293–10297 | **`inflightGrace = 1100`** (comment: was 700; covers webrtc ~520+350 + connectBudget ~1100) |
| Hybrid grace | same | **400** (unchanged) |
| Real-wire gate | ~10276–10287 | early return only on `_offerEmitOk` / remote answer / live media — no localDescription-alone false success |
| Waves | handleMatched ~25591–25596 | force_relay denser list ends 4500; hybrid default list ends 2600 |

### 2. `kickSoloWebRtc` connectBudget — hop10 pure 1100

| Item | Location | State |
|------|----------|-------|
| Pure force_relay offerer | ~27070–27075 | **`connectBudgetMs = 1100`** (`purePath ? 1100 : 750`) |
| Hybrid offerer | same | **750** |
| Answerer | same | **1800** |
| Emit-ok free | ~27116–27121 | poll frees `_inflight` on `_offerEmitOk` / answer without waiting full budget |
| finally clears mutex | ~27144–27148 | always |

### 3. Offerer GUM async SDP-first — hop10

| Item | Location | State |
|------|----------|-------|
| Offerer cold GUM | ~26646–26700 | **fire-and-forget** `getUserMedia` → attach + `pushOutboundVideoTracks`; **does not await** before connect |
| Answerer GUM | ~26701–26720 | still races short GUM (**220** ms) |
| Empty-cam offerer | ~26738+ | proceeds with empty transceivers (“SDP with empty transceivers”) |

### 4. pool=0 — PASS (unchanged)

| Item | Location | Verdict |
|------|----------|---------|
| `ICE_CANDIDATE_POOL_SIZE = 0` | `ui/webrtc.js` L17 | PASS |
| `ICE_RELAY_POOL_SIZE = 0` | L19 | PASS |
| hide_ip / force_relay / normal `poolSize = 0` | ~519–560 | PASS |
| handleMatched pure warm comment | `live.js` ~25534 | single media ALLOCATE **pool=0** |
| No hop10 path sets pool ≥1 | grep | **0 hits** PASS |

### 5. No dual-offer thrash introduced — PASS

| Guard | Location | Verdict |
|-------|----------|---------|
| Mutex + emitOk skip | kickSolo ~26589–26607 | concurrent skip if emitOk or stuck &lt;400ms |
| Match already on wire | ~26615–26629 | skip when `_offerEmitOk` within 12s |
| Never dual-offer comment | ~26593 | explicit |
| Keep offer-ok young PC | ~26851–26860 | no second PC for 12s after emit |
| Mid-offer young keep | ~26863–26880 | &lt;1100ms; **never clear offerSentOnce** if match emit ok (historical 2nd offer@~800ms) |
| offerKick real SDP only | armOfferKickWatch | re-emit stuck local; does not spawn parallel media ALLOCATE pool |
| Only offerer arms offerKick | handleMatched ~25590–25599 | answerer clears watch |

Hop10 **raises** pure grace/budget to **cover** first-path gather (aligns L2 #1/#3) — reduces tear-mid-gather thrash rather than adding second offers.

## Ship pin

| Asset | Pin |
|-------|-----|
| `ui/live.html` preload + script | **`live.js?v=569`** (disk) |
| Plan / wiki smoke tip | **`live.js?v=569`** · **`webrtc.js?v=315`** |

## Docs updated

| Path | Change |
|------|--------|
| `knowledge/wiki/linking-speed.md` | hop10 history row; smoke → **v=569**; residual **mto 1264 / mta 2700 unchanged**; GOAL_MET still needs product.ok; log line |
| `knowledge/specs/CONNECT-IMPROVE-PLAN.md` | disk pin **569**; P4 **PARTIAL DONE**; progress stamp P0 OPEN + hop10 verify COMPLETE; human smoke PC pin **569** |

## Explicit non-claims

- **No product.ok** invented from this verify.
- **No hop10 speed GOAL_MET** — residual targets unchanged; needs re-smoke product.ok after hard-refresh **569** (+ phone APK as applicable).
- **No** MediaSession / webrtc.js / deploy edits.
- **No** pure `relayWaitBudgetMs` cut (still hop9 **520** / warm **350** on webrtc).

## Must-not confirmed

- **pool>0:** none  
- **dual-offer thrash:** guards intact; hop10 budgets/grace reduce mid-path tear  
- **product.ok / GOAL_MET:** not claimed  

## Job complete

Running job → done; RESULT filed. Docs-only write; code read-only confirm.
