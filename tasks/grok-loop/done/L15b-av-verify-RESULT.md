# L15b-av-verify — RESULT

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
- Stamp: **20260812T032506Z**
- At: **2026-08-12T03:25:06Z**
- Window: last **20 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp file: `artifacts/av-verify/20260812T032506Z.json`

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **one-way** |
| **product.done** | **false** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 14 / 14 / 13 |
| **max_mto_ms** (match→offer) | **3112** |
| **max_mta_ms** (match→answer) | **3882** |
| max_mti_ms (match→ice) | 3881 |
| last match platforms | web ↔ web |
| last_force_relay | true |
| **force_relay_mismatch** | **false** |
| force_relay hub / web / android | true / true / null (policy=null) |
| **app_vc** | **null** |
| bind_v | null |
| web fin / fout | 3111 / 3466 |
| android fin / fout | 0 / 0 |
| phone_to_pc / pc_to_phone | true / false |
| TURN max_rb | 613960 |
| TURN peer_hot / alloc_ok | 216 / 41 |
| coturn err_437 | 0 |
| av_paths (window) | 269 |
| av_path best fin/fout | 3111 / 3466 |

## Product block (from latest.json)

```json
{
  "status": "one-way",
  "done": false,
  "min_frames": 10,
  "web_frames_in": 3111,
  "web_frames_out": 3466,
  "android_frames_in": 0,
  "android_frames_out": 0,
  "phone_to_pc": true,
  "pc_to_phone": false,
  "force_relay_hub": "true",
  "force_relay_web": true,
  "force_relay_android": null,
  "android_policy": null,
  "force_relay_mismatch": false,
  "app_vc": null,
  "bind_v": null,
  "hub_fr_beacon": null
}
```

## mto / mta

| Metric | ms | Gate note |
|--------|-----|-----------|
| **max_mto** (match→first offer) | **3112** | WARN only if >8000 — OK |
| **max_mta** (match→first answer) | **3882** | WARN only if >10000 — OK |
| max_mti (match→ice) | 3881 | informational |

Last match (~03:24:08Z): web↔web, force_relay=true; first offer mto≈1747ms, first answer mta≈2363ms. Earlier SLOW first-offer log still max_mto=3112 (under 8s gate). Relay candidates last offer/answer: 1/1.

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| **WARN** | answers (13) < offers (14) — some pairs no answer |
| PASS | TURN media HOT max_rb=613960 peer_hot=216 |
| **WARN** | PRODUCT one-way (PC→phone weak): web fin/fout=3111/3466 android fin/fout=0/0 |

## Notes (honest)

- **verdict=WARN** (exit 3): answers lag offers by 1 **and** product is not dual-direction complete.
- **product.status=one-way**, `done=false`. Web frames solid (3111/3466 vs min_frames=10); **android fin/fout=0/0** in the 20m window — no android av_path wave, so PC→phone product path is weak / not proven.
- mto/mta within healthy bounds (max_mto=3112, max_mta=3882 — no slow-offer >8s / slow-answer >10s gate).
- force_relay=true on last web↔web match; fr_mismatch=false. app_vc/bind_v/android_policy null (no android client beacon in window).
- Last scored match platforms are **web↔web** only. TURN HOT (max_rb=613960, peer_hot=216, err_437=0) — infrastructure media plane OK; product not ship-ready on android dual direction.
- **Explicit: not multi GOAL_MET** — this is **1v1 solo** A/V scorecard only. Web↔web harness pairs ≠ multi-party 3/4-way product PASS. **No invent multi 3/4-way PASS.**
- Agents: read `verdict` **and** `product.status` in `latest.json`; do not ship on infra PASS alone. Here media_pass=true but product.one-way / done=false.
- No human faces ≥30s claim; machine product.one-way only.

## Not done (by design)

- No product / UI / mobile edits
- No deploy / `push.sh` / APK / AAB
- No invent multi PASS / multi GOAL_MET
- No skill / wiki compound (scorecard-only task)

## Connect risk

**None** — read-only hub journal scorecard via `av-verify.sh`. No ICE / pool / MediaSession / live.js / Android media touch.

## Files

- Task card: `/home/drakosik/freenet-roulette/tasks/grok-loop/running/L15b-av-verify.md` (source)
- Canonical RESULT (session): `/home/drakosik/tasks/grok-loop/done/L15b-av-verify-RESULT.md`
- Repo mirror: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L15b-av-verify-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp 20260812T032506Z)

## COMPLETE

**verdict=WARN · product.status=one-way · done=false · max_mto=3112ms · max_mta=3882ms · web 3111/3466 · android 0/0 · fr_mismatch=false · app_vc=null · answers 13 < offers 14.**  
1v1 only — **no invent multi PASS.**
