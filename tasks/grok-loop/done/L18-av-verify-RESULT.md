# L18-av-verify — RESULT

## Status
**COMPLETE**

## OWN
- RESULT under `tasks/grok-loop/done/` only
- No product code edits
- No deploy / APK / phone adb thrash
- **No invent multi PASS / GOAL_MET**
- **No invent blur PASS**

## Goal
Run `./scripts/av-verify.sh` scorecard; report **product** + gates honestly.

## Source
- Live run: `cd /home/drakosik/freenet-roulette && ./scripts/av-verify.sh` (default `--min 20`)
- Shell exit: **3** (WARN)
- Stamp: **20260812T033849Z**
- At: **2026-08-12T03:38:49Z**
- Window: last **20 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp file: `artifacts/av-verify/20260812T033849Z.json`

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **one-way** |
| **product.done** | **false** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 4 / 4 / 3 |
| **max_mto_ms** (match→offer) | **1747** |
| **max_mta_ms** (match→answer) | **2581** |
| max_mti_ms (match→ice) | 2763 |
| last match platforms | web ↔ web |
| last_force_relay | true |
| **force_relay_mismatch** | **false** |
| force_relay hub / web / android | true / true / null (policy=null) |
| **app_vc** | **null** |
| bind_v | null |
| web fin / fout | 3111 / 3466 |
| android fin / fout | 0 / 0 |
| phone_to_pc / pc_to_phone | true / false |
| TURN max_rb | 496382 |
| TURN peer_hot / alloc_ok | 55 / 9 |
| coturn err_437 | 0 |
| av_paths (window) | 61 |
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
| **max_mto** (match→first offer) | **1747** | WARN only if >8000 — OK |
| **max_mta** (match→first answer) | **2581** | WARN only if >10000 — OK |
| max_mti (match→ice) | 2763 | informational |

Last match (~03:24:08Z): web↔web multi-pair harness users (`multi-pair-otiwr6-multia` / `multib`), force_relay=true; first offer mto≈1747ms, first answer mta≈2363ms. Window max_mto=1747 / max_mta=2581 (healthy). Relay candidates last offer/answer: 1/1.

Earlier match (~03:22:51Z): first offer from web mto=1191ms — **no first-answer line in recent window tail** for that pair → contributes to answers (3) < offers (4). **No android av_path** in scored product window → android fin/fout stay 0/0.

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| **WARN** | answers (3) < offers (4) — some pairs no answer |
| PASS | TURN media HOT max_rb=496382 peer_hot=55 |
| **WARN** | PRODUCT one-way (PC→phone weak): web fin/fout=3111/3466 android fin/fout=0/0 |

## Phone / adb (soft)

| Item | Value |
|------|--------|
| `adb` on PATH | **not found** this session — soft skip USB/network adb |
| Hub product beacons | **no** android av_path / app_vc / bind_v in 20m window |

Cannot soft-assert APK versionCode this hop (no adb). Hub scorecard still shows **zero android product frames** — not a phone-adb failure inventing product PASS.

## Notes (honest)

- **verdict=WARN** (exit 3): answers lag offers by 1 **and** product is not dual-direction complete.
- **product.status=one-way**, `done=false`. Web frames solid (3111/3466 vs min_frames=10); **android fin/fout=0/0** — no android av_path wave, so PC→phone product path is weak / not proven.
- mto/mta within healthy bounds (max_mto=1747, max_mta=2581) — faster than L17 window peaks (3112/3882) as older slow pairs aged out of the 20m window.
- force_relay=true on last web↔web match; fr_mismatch=false. app_vc/bind_v/android_policy null (no android client beacon in window).
- Last scored match platforms are **web↔web** only. TURN HOT (max_rb=496382, peer_hot=55, err_437=0) — infrastructure media plane OK; product **not** ship-ready on android dual direction.
- **Explicit: not multi GOAL_MET** — this is **1v1 solo** A/V scorecard only. Multi-pair *user name* labels in journal (`multi-pair-*-multia/b`) ≠ multi-party 3/4-way product PASS. **No invent multi 3/4-way PASS.**
- **No invent blur PASS** — blur not measured by this scorecard.
- Agents: read `verdict` **and** `product.status` in `latest.json`; do not ship on infra PASS alone. Here media_pass=true but product.one-way / done=false.
- No human faces ≥30s claim; machine product.one-way only.
- vs L17 (stamp 20260812T033604Z): same product story (one-way, android 0/0, web frames hot); window counts slid to matches 4/4/3 (was 5/5/4); mto/mta peak lower; peer_hot 55 (was 87).
- Next (from tool): Human PC hard-refresh + phone Start; leave linked 20s; re-run `./scripts/av-verify.sh --min 10`. PRODUCT one-way → client-ice path if media_pass stays true (do not thrash TURN).

## Not done (by design)

- No product / UI / mobile edits
- No deploy / `push.sh` / APK / AAB
- No invent multi PASS / multi GOAL_MET / blur PASS
- No skill / wiki compound (scorecard-only task)

## Connect risk

**None** — read-only hub journal scorecard via `av-verify.sh`. No ICE / pool / MediaSession / live.js / Android media touch.

## Files

- Session RESULT: `/home/drakosik/tasks/grok-loop/done/L18-av-verify-RESULT.md`
- Repo mirror: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L18-av-verify-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp 20260812T033849Z)

## COMPLETE

**verdict=WARN · product.status=one-way · done=false · max_mto=1747ms · max_mta=2581ms · web 3111/3466 · android 0/0 · fr_mismatch=false · app_vc=null · answers 3 < offers 4.**  
1v1 only — **no invent multi PASS · no invent blur PASS.**
