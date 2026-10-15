# T8 av-verify scorecard — RESULT

## Status
**COMPLETE**

## Source
- Live run: `./scripts/av-verify.sh` (repo root) → `/tmp/t8-av-verify.log`
- Exit: **0**
- Stamp: **20260812T023625Z**
- At: **2026-08-12T02:36:25Z**
- Window: last **20 min**
- Artifacts:
  - `artifacts/av-verify/latest.json`
  - `artifacts/av-verify/latest.md`
- No deploy, no exclusive phone thrash, no invented multi PASS / GOAL_MET

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 6 / 5 / 5 |
| **max_mto_ms** (match→offer) | **1420** |
| **max_mta_ms** (match→answer) | **2559** |
| max_mti_ms (match→ice) | 2713 |
| last match platforms | web ↔ android |
| last_force_relay | true |
| **force_relay_mismatch (fr_mismatch)** | **False** |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| **app_vc** | **374** |
| bind_v | 1 |
| web fin / fout | 392 / 461 |
| android fin / fout | 211 / 178 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 510394 |
| TURN peer_hot / alloc_ok | 94 / 14 |
| coturn err_437 | 0 |
| av_paths (window) | 112 |
| av_path best fin/fout | 392 / 461 |

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| PASS | signaling OK: matches=6 offers=5 answers=5 |
| PASS | TURN media HOT max_rb=510394 peer_hot=94 |
| PASS | PRODUCT both directions: web fin/fout=392/461 android fin/fout=211/178 |

## Notes (honest)

- Infra + product aligned: `verdict=PASS`, `product.status=ok`, `done=true`.
- Last match web↔android, force_relay=true, fr_mismatch=False, app_vc=374, bind_v=1.
- mto/mta: max_mto=1420ms, max_mta=2559ms (signaling_ok).
- Dual-direction frames solid: web 392/461, android 211/178 (both well above min_frames=10).
- **Explicit: not multi GOAL_MET** — this is 1v1 solo A/V scorecard only. No invent multi 3/4-way PASS.
- Agents: read `verdict` **and** `product` in `latest.json`; do not ship on infra PASS alone.
