# CONN-L5-synth RESULT

## Status
**COMPLETE** (L1–L4 harvested; Claude 450–452 still pending)

## OWN
- `knowledge/specs/CONNECT-IMPROVE-PLAN.md` (created + updated with full Grok harvest)
- `tasks/grok-loop/done/CONN-L5-synth-RESULT.md` (this file)
- `knowledge/raw/2026-08-12-connect-improve-loop.md` (short summary)
- No product code · no deploy · no APK · no invent multi/blur PASS · no invent product.ok / GOAL_MET

## Goal
Director scribe: harvest CONN-L1..L4 + Claude pending if present; write ranked connect/linking improve plan.

## Harvest

| Input | Status | Notes |
|-------|--------|-------|
| `artifacts/connect-loop/baseline-av-verify.*` | **READ** | 2026-08-12T04:48:52Z · WARN · product **one-way** |
| wiki linking-speed / gotchas / one-way-video | **READ** | hop9 residual; belts; historical one-way RESOLVED |
| specs current-linking-speed / current-av | **READ** | Active speed · A/V DONE regression |
| **CONN-L1-diagnose-RESULT** | **HARVESTED** | NEXT_ROLE=**android-answer**; TURN HOT; android av_path silence |
| **CONN-L2-web-kick-RESULT** | **HARVESTED** | Top7: connectBudget vs pure wait · GUM parallel · inflightGrace · pin **live.js?v=568** · paint-first · force warm · offerKick tear phases |
| **CONN-L3-android-RESULT** | **HARVESTED** | Top7: A vs B triage · answer serial · policy=all→relay · early kick · av_path interval · APK **0.1.370-vc378** · smoke |
| **CONN-L4-hub-turn-RESULT** | **HARVESTED** | Media **HOT** freeze; answers&lt;offers = dual-web + android silence + window cut; NEXT_ROLE=**client-ice**; hub log-only |
| Claude **450–452** | **PENDING** | admin-queue pending; session limit may block ~00:20 Edmonton |

## Scorecard snapshot (do not invent)

| Field | Value |
|-------|--------|
| at | 2026-08-12T04:48:52Z |
| verdict | **WARN** |
| product.status | **one-way** · done=false |
| web fin/fout | 62634 / 62634 |
| android fin/fout | **0 / 0** |
| android av_path | **none** (all web; dual-web HOT pairs) |
| app_vc / bind_v | null / null |
| force_relay hub/web/android | true / true / null |
| offers / answers | 3 / **2** |
| max_mto / max_mta | 1999 / 3368 |
| last answer relay_candidates | **0** |
| max_rb / err_437 | 498789 / **0** (HOT) |
| last platforms | web ↔ android |

## Synth conclusions (P0→P5)

| # | Action | Source |
|---|--------|--------|
| **P0** | Phone smoke + android av_path (APK **0.1.370-vc378**; PC **live.js?v=568**) — app_vc=null = missing phone, not encode FAIL | L1+L3+L4 |
| **P1** | client-ice android-answer: beacon reliability + answer completeness; real one-way only if android beacon proves (B) | L1+L3 |
| **P2** | Earliest answer kick (android-ui) · close answers&lt;offers | L3 |
| **P3** | Layer A policy=all→relay under hub pure | L3 · hop9 residual |
| **P4** | Web-kick reliability/feel (L2 Top7) after product.ok; no pure budget cut &lt;520 without gate | L2 |
| **P5** | Hub observability only; **never** coturn restart while HOT | L4 |

**GOAL_MET** only product.ok or human faces; speed GOAL_MET only after product.ok + journal beat residual **1264/2700**.

## Artifacts written

| Path | Role |
|------|------|
| [`knowledge/specs/CONNECT-IMPROVE-PLAN.md`](../../../knowledge/specs/CONNECT-IMPROVE-PLAN.md) | Ranked P0→P5 + loop protocol |
| [`knowledge/raw/2026-08-12-connect-improve-loop.md`](../../../knowledge/raw/2026-08-12-connect-improve-loop.md) | Short raw summary |
| this RESULT | harvest + honesty |

## GOAL_MET
**no** — plan/recommendations only; product still one-way in baseline window.

## DO_NOT
- Invent product.ok / multi PASS / blur PASS
- Deploy / APK without human authorize
- Coturn thrash / dual-relay change while max_rb HOT (L4 freeze)
- pool&gt;0 · dual writers on MediaSession/live.js
- Merge Claude 450–452 as fact until RESULT files exist

## Next
1. Human: P0 smoke — APK **0.1.370-vc378** + PC hard-refresh **`live.js?v=568`** / **`webrtc.js?v=315`** · hold ≥20s · `./scripts/av-verify.sh --min 10`.  
2. When Claude session free: run 450–452 recommend tasks; re-append plan.  
3. Implementer hop only after P0 clarifies A vs B + human proceed — **one writer** per MediaSession / live.js.
