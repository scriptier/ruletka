# T1 av-verify scorecard — RESULT

## Status
**COMPLETE**

## Source
- Live run: `./scripts/av-verify.sh` (repo root)
- Exit: **0**
- Stamp: **20260812T021139Z**
- At: **2026-08-12T02:11:39Z**
- Window: last **20 min**
- Artifacts:
  - `artifacts/av-verify/latest.json`
  - `artifacts/av-verify/latest.md`
- No deploy, no APK, no invented multi PASS / GOAL_MET

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 3 / 3 / 3 |
| **max_mto_ms** (match→offer) | **1388** |
| **max_mta_ms** (match→answer) | **2582** |
| max_mti_ms (match→ice) | 2748 |
| last match platforms | web ↔ web |
| last_force_relay | true |
| **force_relay_mismatch (fr_mismatch)** | **False** |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| **app_vc** | **374** |
| bind_v | 1 |
| web fin / fout | 426 / 343 |
| android fin / fout | 158 / 189 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 544101 |
| TURN peer_hot / alloc_ok | 9 / 7 |
| coturn err_437 | 0 |
| av_paths (window) | 34 |

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| PASS | signaling OK: matches=3 offers=3 answers=3 |
| PASS | TURN media HOT max_rb=544101 peer_hot=9 |
| PASS | PRODUCT both directions: web fin/fout=426/343 android fin/fout=158/189 |

## Notes (honest)

- Infrastructure + product dual-direction frames both green in this 20m window (web+android beacons present).
- Last matched pair in snapshot was **web↔web** with force_relay=true; android still contributed dual frames in-window.
- **Does not claim multi 3/4-way PASS or GOAL_MET** — human smoke for multi still open per task card.
- Agents: always read `product` + `verdict` in `latest.json`; infra PASS alone is not product success (here both aligned: ok).
