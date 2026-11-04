# L14-av-verify — RESULT

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
- Shell exit: **3** (WARN)
- Stamp: **20260812T031743Z**
- At: **2026-08-12T03:17:43Z**
- Window: last **20 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp file: `artifacts/av-verify/20260812T031743Z.json`

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 22 / 23 / 21 |
| **max_mto_ms** (match→offer) | **3344** |
| **max_mta_ms** (match→answer) | **5446** |
| max_mti_ms (match→ice) | 5444 |
| last match platforms | web ↔ web |
| last_force_relay | true |
| **force_relay_mismatch** | **false** |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| **app_vc** | **375** |
| bind_v | 1 |
| web fin / fout | 2428 / 2662 |
| android fin / fout | 255 / 229 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 613960 |
| TURN peer_hot / alloc_ok | 217 / 55 |
| coturn err_437 | 4 |
| av_paths (window) | 388 |
| av_path best fin/fout | 2428 / 2662 |

## Product block (from latest.json)

```json
{
  "status": "ok",
  "done": true,
  "min_frames": 10,
  "web_frames_in": 2428,
  "web_frames_out": 2662,
  "android_frames_in": 255,
  "android_frames_out": 229,
  "phone_to_pc": true,
  "pc_to_phone": true,
  "force_relay_hub": "true",
  "force_relay_web": true,
  "force_relay_android": 1,
  "android_policy": "relay",
  "force_relay_mismatch": false,
  "app_vc": 375,
  "bind_v": 1,
  "hub_fr_beacon": 1
}
```

## mto / mta

| Metric | ms | Gate note |
|--------|-----|-----------|
| **max_mto** (match→first offer) | **3344** | WARN only if >8000 — OK |
| **max_mta** (match→first answer) | **5446** | WARN only if >10000 — OK |
| max_mti (match→ice) | 5444 | informational |

Last match (~03:17:39Z): web↔web multi-pair harness users (`multi-pair-1d7zz0-multia` / `multib`), force_relay=true; first offer SLOW log mto≈3112ms (still under 8s gate). Relay candidates last offer/answer: 1/0.

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| **WARN** | answers (21) < offers (23) — some pairs no answer |
| PASS | TURN media HOT max_rb=613960 peer_hot=217 |
| PASS | PRODUCT both directions: web fin/fout=2428/2662 android fin/fout=255/229 |

## Notes (honest)

- **verdict=WARN** (exit 3) solely because answers lag offers by 2 in the 20m window — not media-dead, not one-way.
- **product.status=ok**, `done=true`, dual-direction frames solid vs min_frames=10: web 2428/2662, android 255/229 (android wave_12000 at ~03:15:09Z; web continued climbing on interval beacons).
- mto/mta within healthy bounds (no slow-offer >8s / slow-answer >10s gate). max_mto=3344, max_mta=5446.
- force_relay=true, fr_mismatch=false, app_vc=375, bind_v=1.
- Last scored match platforms are **web↔web** (harness multi-pair labels in user ids) — still **solo** hub journal scorecard; android product frames from earlier web↔android in-window.
- err_437=4 is low (not a 437 storm); media_pass remains true (max_rb HOT).
- **Explicit: not multi GOAL_MET** — this is **1v1 solo** A/V scorecard only. Multi-pair *user name* labels in journal ≠ multi-party 3/4-way product PASS. **No invent multi 3/4-way PASS.**
- Agents: read `verdict` **and** `product.status` in `latest.json`; do not ship on infra alone. Here product is ok but overall verdict is WARN on incomplete answers.
- No human faces ≥30s claim; machine product.ok only.

## Not done (by design)

- No product / UI / mobile edits
- No deploy / `push.sh` / APK / AAB
- No invent multi PASS / multi GOAL_MET
- No skill / wiki compound (scorecard-only task)

## Connect risk

**None** — read-only hub journal scorecard via `av-verify.sh`. No ICE / pool / MediaSession / live.js / Android media touch.

## Files

- Canonical RESULT (session): `/home/drakosik/tasks/grok-loop/done/L14-av-verify-RESULT.md`
- Repo mirror: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L14-av-verify-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp 20260812T031743Z)

## COMPLETE

**verdict=WARN · product.status=ok · max_mto=3344ms · max_mta=5446ms · web 2428/2662 · android 255/229 · fr_mismatch=false · app_vc=375 · answers 21 < offers 23.**  
1v1 only — **no invent multi PASS.**
