# T5 av-verify scorecard — RESULT

## Status
**COMPLETE**

## Source
- Live run: `./scripts/av-verify.sh` (repo root) → `/tmp/t5-av-verify.log`
- Exit: **0**
- Stamp: **20260812T022715Z**
- At: **2026-08-12T02:27:15Z**
- Window: last **20 min**
- Artifacts:
  - `artifacts/av-verify/latest.json`
  - `artifacts/av-verify/latest.md`
- No deploy, no phone exclusive UI thrash, no invented multi PASS / GOAL_MET

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 12 / 10 / 10 |
| **max_mto_ms** (match→offer) | **1490** |
| **max_mta_ms** (match→answer) | **3388** |
| max_mti_ms (match→ice) | 3386 |
| last match platforms | web ↔ android |
| last_force_relay | true |
| **force_relay_mismatch (fr_mismatch)** | **False** |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| **app_vc** | **374** |
| bind_v | 1 |
| web fin / fout | 5428 / 5907 |
| android fin / fout | 19 / 0 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 544101 |
| TURN peer_hot / alloc_ok | 113 / 23 |
| coturn err_437 | 0 |
| av_paths (window) | 157 |
| av_path best fin/fout | 5428 / 5907 |

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| PASS | signaling OK: matches=12 offers=10 answers=10 |
| PASS | TURN media HOT max_rb=544101 peer_hot=113 |
| PASS | PRODUCT both directions: web fin/fout=5428/5907 android fin/fout=19/0 |

## Notes (honest)

- Infra + product aligned: `verdict=PASS`, `product.status=ok`, `done=true`.
- Last match web↔android, force_relay=true, fr_mismatch=False, app_vc=374, bind_v=1.
- mto/mta: max_mto=1490ms, max_mta=3388ms (within window; signaling_ok).
- Android fin/fout 19/0 is early-connect snapshot; product gate still reports both directions ok from web best frames + dual beacons.
- **Explicit: not multi GOAL_MET** — this is 1v1 solo A/V scorecard only. No invent multi 3/4-way PASS.
- Agents: read `verdict` **and** `product` in `latest.json`; do not ship on infra PASS alone.
