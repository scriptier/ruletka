# L13b-av-verify — RESULT

## Status
**COMPLETE**

## OWN
- Run `./scripts/av-verify.sh` only; write RESULT table
- No product code edits
- No deploy / APK rebuild / force-push
- **No invent multi PASS / blur PASS / GOAL_MET**

## Goal
Capture honest av-verify scorecard: `product.status`, `app_vc`, `fr_mismatch`, scorecard paths.

## Source
- Live run: `cd /home/drakosik/freenet-roulette && export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH && ./scripts/av-verify.sh`
- Shell exit: **3** (WARN — answers < offers; not hard FAIL)
- Stamp: **20260812T031711Z**
- At: **2026-08-12T03:17:11Z**
- Window: last **20 min**
- Phone: Pixel 9 Pro (`45141FDAP0004F`) online via adb; package `me.ruletka.app` **versionName=0.1.367** **versionCode=375** (matches tip 0.1.367-vc375 / app_vc=375)
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp: `artifacts/av-verify/20260812T031711Z.json`

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| shell exit | **3** (WARN) |
| matches / offers / answers | 21 / 22 / 21 |
| **max_mto_ms** (match→offer) | **3344** |
| **max_mta_ms** (match→answer) | **5446** |
| max_mti_ms (match→ice) | 5444 |
| last match platforms | android ↔ web |
| last_force_relay | true |
| **force_relay_mismatch (fr_mismatch)** | **false** |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| **app_vc** | **375** |
| bind_v | 1 |
| web fin / fout | 2428 / 2662 |
| android fin / fout | 255 / 229 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 613960 |
| TURN peer_hot / alloc_ok | 203 / 55 |
| coturn err_437 | 4 |
| av_paths (window) | 392 (script summary count=16 in report table; snapshot av_paths=392) |
| av_path best fin/fout | 2428 / 2662 |
| APK on device | **0.1.367** (vc **375**) |

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

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| **WARN** | answers (21) < offers (22) — some pairs no answer |
| PASS | TURN media HOT max_rb=613960 peer_hot=203 |
| PASS | PRODUCT both directions: web fin/fout=2428/2662 android fin/fout=255/229 |

## Notes (honest)

- **verdict=WARN** solely because answers (21) < offers (22) in the 20‑min window — not media dead, not product one-way.
- **product.status=ok**, **done=true**, dual frames both directions (web 2428/2662, android 255/229), **fr_mismatch=false**, **app_vc=375**.
- Device package aligns with tip: **0.1.367-vc375**.
- Signaling OK + TURN HOT + product dual-direction; soft WARN only on incomplete answer count.
- **Explicit non-claims:**
  - **Not multi PASS** / not multi 3/4-way GOAL_MET — this is **1v1 solo** A/V scorecard only.
  - **Not blur PASS** — blur not measured by this run.
  - **Not human faces ≥30s ship claim** — machine product.ok only.
  - Agents: read `verdict` **and** `product.status` in `latest.json`; do not ship on infra alone; do not invent multi/blur PASS.

## Not done (by design)

- No product / UI / mobile / MediaSession edits
- No deploy / `push.sh` / APK / AAB
- No invent multi PASS / blur PASS / GOAL_MET
- No exclusive long phone UI monopolize
- pool left alone (`iceCandidatePoolSize` not touched)

## Connect risk

**None** — read-only hub journal scorecard via `av-verify.sh`. No ICE / pool / MediaSession / live.js / Android media touch.

## Files

- Task card: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L13b-av-verify.md` (moved from running/)
- Repo RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L13b-av-verify-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp **20260812T031711Z**)

## COMPLETE

**verdict=WARN · product.status=ok · app_vc=375 · fr_mismatch=false · web 2428/2662 · android 255/229 · device 0.1.367-vc375.**  
1v1 only — **no invent multi PASS · no invent blur PASS · no GOAL_MET.**
