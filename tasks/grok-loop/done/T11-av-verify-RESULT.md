# T11-av-verify — RESULT

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
- Stamp: **20260812T024320Z**
- At: **2026-08-12T02:43:20Z**
- Window: last **20 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp file: `artifacts/av-verify/20260812T024320Z.json`

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 8 / 8 / 8 |
| **max_mto_ms** (match→offer) | **1692** |
| **max_mta_ms** (match→answer) | **3117** |
| max_mti_ms (match→ice) | 3276 |
| last match platforms | android ↔ web |
| last_force_relay | true |
| **force_relay_mismatch** | **false** |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| **app_vc** | **374** |
| bind_v | 1 |
| web fin / fout | 1867 / 783 |
| android fin / fout | 204 / 187 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 599021 |
| TURN peer_hot / alloc_ok | 93 / 21 |
| coturn err_437 | 0 |
| av_paths (window) | 159 |
| av_path best fin/fout | 1867 / 783 |

## Product block (from latest.json)

```json
{
  "status": "ok",
  "done": true,
  "min_frames": 10,
  "web_frames_in": 1867,
  "web_frames_out": 783,
  "android_frames_in": 204,
  "android_frames_out": 187,
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
| **max_mto** (match→first offer) | **1692** | WARN only if >8000 — OK |
| **max_mta** (match→first answer) | **3117** | WARN only if >10000 — OK |
| max_mti (match→ice) | 3276 | informational |

Last match platforms: android ↔ web, force_relay=true. Relay candidates last offer/answer: 1/0.

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| PASS | signaling OK: matches=8 offers=8 answers=8 |
| PASS | TURN media HOT max_rb=599021 peer_hot=93 |
| PASS | PRODUCT both directions: web fin/fout=1867/783 android fin/fout=204/187 |

## Notes (honest)

- Infra + product aligned: `verdict=PASS`, `product.status=ok`, `done=true`.
- Last match android↔web, force_relay=true, fr_mismatch=false, app_vc=374, bind_v=1.
- Dual-direction frames solid vs min_frames=10: web 1867/783, android 204/187.
- mto/mta within healthy bounds (no slow-offer / slow-answer WARN).
- Web av_path continued climbing after android wave_12000 (fin/fout 204/187 at ~02:41:45Z) — product still both directions with strong web counters.
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

- Task card: `/home/drakosik/freenet-roulette/tasks/grok-loop/running/T11-av-verify.md` (source)
- Canonical RESULT (session): `/home/drakosik/tasks/grok-loop/done/T11-av-verify-RESULT.md`
- Repo mirror: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/T11-av-verify-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp 20260812T024320Z)

## COMPLETE

**verdict=PASS · product.status=ok · max_mto=1692ms · max_mta=3117ms · web 1867/783 · android 204/187 · fr_mismatch=false · app_vc=374.**  
1v1 only — **no invent multi PASS.**
