# CONN idle-green residual after F36 — RESULT

**Job:** `tasks/grok-loop/running/45-CONN-idle-green-F36.md` → done  
**OWN:** docs only — one residual stamp on `knowledge/specs/CONNECT-IMPROVE-PLAN.md`  
**Must not:** MediaSession / live.js · deploy · invent multi PASS · invent GOAL_MET · touch SMOKE-NEXT / BLUR-MULTI-FINISH-PLAN

## Status
**COMPLETE** · residual stamp only · **NEXT_ROLE=idle/ship** · no thrash · no invent

## Goal (this hop)
Confirm still no thrash needed after last phone-smoke green; F35–F36 (and F34) keyguard means no new android multi sample required this hop. Stamp plan residual. Do not invent multi PASS / linking-speed GOAL_MET.

## Evidence used (no invent)

### 1) Last phone-smoke — still tip scorecard

| Source | Field | Value |
|--------|-------|--------|
| `tasks/grok-loop/done/CONN-smoke-phone-avpath-RESULT.md` | stamp | **`20260812T064214Z`** @ **2026-08-12T06:42:14Z** |
| Prior residual | `CONN-idle-green-F34-RESULT.md` | same tip restamped (F34 hop) |
| **verdict** | | **PASS** |
| **product.status** | | **ok** · done=true |
| app_vc / tip | | **382** / versionName **0.1.374** |
| android fin/fout | | **756 / 678** |
| web fin/fout | | **670 / 776** |
| android av_path | | **yes** · bind_v=1 · policy=relay · fr=1 |
| platforms | | **web ↔ android** |
| max_mto / max_mta | | **1895 / 3122** (still above stretch → **no** linking-speed GOAL_MET) |
| TURN | | max_rb **499165** HOT · err_437=0 |
| multi PASS invent? | | **NO** — 1v1 only in that smoke |

### 2) F34 / F35 / F36 keyguard — still BLOCKED (no new android multi sample this hop)

| Source | Field | Value |
|--------|-------|--------|
| `tasks/grok-loop/done/BLUR-F34-multi-soft-unlock-retry-RESULT.md` | status | **BLOCKED COMPLETE (keyguard)** |
| `tasks/grok-loop/done/BLUR-F35-multi-soft-unlock-retry-RESULT.md` | status | **BLOCKED COMPLETE (keyguard)** |
| `tasks/grok-loop/done/BLUR-F36-multi-soft-unlock-retry-RESULT.md` | status | **BLOCKED COMPLETE (keyguard)** |
| unlock gate (F36) | `isKeyguardShowing` | **true** |
| unlock gate (F36) | `mDreamingLockscreen` | **true** |
| focus (F36) | | `AlternateBouncerView` (systemui) |
| package tip | | **0.1.374** / **vc382** (same tip as phone-smoke) |
| multi SoftBlur device | | **NOT claimed** · no peers≥2 · softNative=0 · Sink=0 |
| multi-pair / Hold | | **not run** (gate stop) |
| artifacts F36 | | `mobile/artifacts/device-smoke/f36-blur/` (e.g. `20260812T094957Z-*`) |

**Implication for CONN:** F34–F36 still keyguard → **no new android connect sample** required or possible this hop for multi SoftBlur. Multi soft remains **open only for multi lane** (BLUR / multi SoftBlur), not a CONN thrash trigger. Do **not** invent multi PASS.

## Residual decision

| Question | Answer |
|----------|--------|
| Thrash MediaSession / live.js this hop? | **NO** — green product.ok tip still holds |
| New android 1v1 sample required this hop? | **NO** — last tip product.ok app_vc=382; F34–F36 keyguard is multi SoftBlur gate only |
| NEXT_ROLE | **idle/ship** (scorecard routing only) |
| linking-speed GOAL_MET | **still no** (mto 1895 / mta 3122) |
| multi PASS | **not claimed** · multi soft open **only multi lane** |
| broader ship / Play / GOAL_MET invent | **NO** |

## Plan edit (`CONNECT-IMPROVE-PLAN.md` — one residual stamp)

1. **Header / Honest:** idle-green residual **CONFIRMED** after F36 · tip still product.ok app_vc=**382** (0.1.374) · **NEXT_ROLE=idle/ship** · F34–F36 still keyguard BLOCKED → multi soft open only multi lane · no invent multi PASS / GOAL_MET  
2. **Progress row:** `CONN idle-green residual after F36` → **COMPLETE** this hop · RESULT this file  
3. F34 progress row demoted from “this hop” to prior COMPLETE (style match)

No scorecard table rewrite (phone-smoke numbers unchanged). No product code. No deploy. Did not touch SMOKE-NEXT or BLUR-MULTI-FINISH-PLAN.

## Non-claims (explicit)

- Did **not** invent multi PASS / MULTI_PASS / multi SoftBlur device PASS  
- Did **not** invent linking-speed GOAL_MET or broader product GOAL_MET  
- Did **not** edit MediaSession / live.js / webrtc.js / live.tsx  
- Did **not** deploy / APK / Play / pool thrash (pool=0 · docs only)  
- Did **not** unlock phone / thrash locksettings  
- Did **not** edit SMOKE-NEXT or BLUR-MULTI-FINISH-PLAN  
- ship/idle = **scorecard routing only**, not Play ship claim

## Done
- [x] Confirmed tip scorecard still product.ok app_vc=382 tip 0.1.374 (`064214Z`)  
- [x] Confirmed F34–F36 still keyguard BLOCKED → no new android multi sample this hop  
- [x] CONNECT-IMPROVE-PLAN residual: NEXT_ROLE=idle/ship · multi soft open only multi lane · F34–F36 keyguard residual  
- [x] RESULT this file  
- [x] Task card moved running → done  
