# T6 av-verify-quick — RESULT

## Status
**COMPLETE**

## Source
- Live run: `./scripts/av-verify.sh` (repo root)
- Exit: **0**
- Stamp: **20260812T022944Z**
- At: **2026-08-12T02:29:44Z**
- Window: last **20 min**
- Artifacts:
  - `artifacts/av-verify/latest.json`
  - `artifacts/av-verify/latest.md`
- No deploy, no APK, no invented multi PASS / GOAL_MET

## RESULT table (product / mto / mta / app_vc)

| Field | Value |
|-------|--------|
| **product.status** | **ok** |
| **product.done** | **true** |
| **max_mto_ms** (match→offer) | **1490** |
| **max_mta_ms** (match→answer) | **3388** |
| **app_vc** | **374** |

## Scorecard (context)

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| hard_fail | false |
| signaling_ok | true |
| media_pass | true |
| matches / offers / answers | 12 / 10 / 10 |
| max_mti_ms (match→ice) | 3386 |
| last match platforms | web ↔ android |
| last_force_relay | true |
| force_relay_mismatch (fr_mismatch) | False |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| bind_v | 1 |
| web fin / fout | 5428 / 5907 |
| android fin / fout | 196 / 180 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 544101 |
| TURN peer_hot / alloc_ok | 117 / 26 |
| coturn err_437 | 0 |
| av_paths (window) | 165 |

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| PASS | signaling OK: matches=12 offers=10 answers=10 |
| PASS | TURN media HOT max_rb=544101 peer_hot=117 |
| PASS | PRODUCT both directions: web fin/fout=5428/5907 android fin/fout=196/180 |

## Notes (honest)

- Infra + product aligned: `verdict=PASS`, `product.status=ok`, `done=true`.
- Key fields as requested: product=**ok**, mto=**1490**, mta=**3388**, app_vc=**374**.
- Last match web↔android, force_relay=true, fr_mismatch=False, dual-direction frames present.
- **Explicit: not multi GOAL_MET** — 1v1 solo A/V scorecard only. No invent multi 3/4-way PASS.
