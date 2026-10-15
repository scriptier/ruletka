# T9-av-verify — RESULT

## Status
**COMPLETE**

## OWN
- RESULT under `tasks/grok-loop/done/` only
- No product code edits
- No deploy / APK / phone adb thrash
- **No invent multi PASS / GOAL_MET**

## Goal
Run `./scripts/av-verify.sh` scorecard; report **product** + **mto/mta** honestly.

## Source
- Live run: `cd /home/drakosik/freenet-roulette && ./scripts/av-verify.sh --min 20`
- Shell exit: **0**
- Stamp: **20260812T023912Z**
- At: **2026-08-12T02:39:12Z**
- Window: last **20 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp file: `artifacts/av-verify/20260812T023912Z.json`

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
| **force_relay_mismatch** | **false** |
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

## Product block (from latest.json)

```json
{
  "status": "ok",
  "done": true,
  "min_frames": 10,
  "web_frames_in": 392,
  "web_frames_out": 461,
  "android_frames_in": 211,
  "android_frames_out": 178,
  "phone_to_pc": true,
  "pc_to_phone": true,
  "force_relay_hub": "true",
  "force_relay_web": true,
  "force_relay_android": 1,
  "android_policy": "relay",
  "force_relay_mismatch": false,
  "app_vc": 374,
  "bind_v": 1,
  "hub_fr_beacon": 1
}
```

## mto / mta

| Metric | ms | Gate note |
|--------|-----|-----------|
| **max_mto** (match→first offer) | **1420** | WARN only if >8000 — OK |
| **max_mta** (match→first answer) | **2559** | WARN only if >10000 — OK |
| max_mti (match→ice) | 2713 | informational |

Example last match (~02:32:25Z): offer mto≈1077ms (web), answer mta≈2214ms (android).

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| PASS | signaling OK: matches=6 offers=5 answers=5 |
| PASS | TURN media HOT max_rb=510394 peer_hot=94 |
| PASS | PRODUCT both directions: web fin/fout=392/461 android fin/fout=211/178 |

## Notes (honest)

- Infra + product aligned: `verdict=PASS`, `product.status=ok`, `done=true`.
- Last match web↔android, force_relay=true, fr_mismatch=false, app_vc=374, bind_v=1.
- Dual-direction frames solid vs min_frames=10: web 392/461, android 211/178.
- mto/mta within healthy bounds (no slow-offer / slow-answer WARN).
- **Explicit: not multi GOAL_MET** — this is **1v1 solo** A/V scorecard only. **No invent multi 3/4-way PASS.**
- Agents: read `verdict` **and** `product.status` in `latest.json`; do not ship on infra PASS alone.
- No human faces ≥30s claim; machine product.ok only.

## Not done (by design)

- No product / UI / mobile edits
- No deploy / `push.sh` / APK / AAB
- No invent multi PASS / multi GOAL_MET
- No skill / wiki compound (scorecard-only task)

## Connect risk

**None** — read-only hub journal scorecard via `av-verify.sh`. No ICE / pool / MediaSession / live.js / Android media touch.

## Files

- Task card: `/home/drakosik/freenet-roulette/tasks/grok-loop/running/T9-av-verify.md` (source)
- Canonical RESULT (session): `/home/drakosik/tasks/grok-loop/done/T9-av-verify-RESULT.md`
- Repo mirror: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/T9-av-verify-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp 20260812T023912Z)

## COMPLETE

**verdict=PASS · product.status=ok · max_mto=1420ms · max_mta=2559ms · web 392/461 · android 211/178 · fr_mismatch=false · app_vc=374.**  
1v1 only — **no invent multi PASS.**
