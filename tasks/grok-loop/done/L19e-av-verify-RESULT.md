# L19e-av-verify — RESULT

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
- Shell exit: **0** (PASS)
- Stamp: **20260812T034413Z**
- At: **2026-08-12T03:44:13Z**
- Window: last **20 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp file: `artifacts/av-verify/20260812T034413Z.json`

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | 4 / 4 / 4 |
| **max_mto_ms** (match→offer) | **1717** |
| **max_mta_ms** (match→answer) | **4072** |
| max_mti_ms (match→ice) | 4069 |
| last match platforms | web ↔ android |
| last_force_relay | true |
| **force_relay_mismatch** | **false** |
| force_relay hub / web / android | true / true / 1 (policy=relay) |
| **app_vc** | **375** |
| bind_v | 1 |
| web fin / fout | 63 / 306 |
| android fin / fout | 254 / 26 |
| phone_to_pc / pc_to_phone | true / true |
| TURN max_rb | 499562 |
| TURN peer_hot / alloc_ok | 17 / 8 |
| coturn err_437 | 0 |
| av_paths (window) | 71 |
| av_path best fin/fout | 254 / 306 |

## Product block (from latest.json)

```json
{
  "status": "ok",
  "done": true,
  "min_frames": 10,
  "web_frames_in": 63,
  "web_frames_out": 306,
  "android_frames_in": 254,
  "android_frames_out": 26,
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
| **max_mto** (match→first offer) | **1717** | WARN only if >8000 — OK |
| **max_mta** (match→first answer) | **4072** | WARN only if >10000 — OK |
| max_mti (match→ice) | 4069 | informational |

Last match (~03:43:49Z): **solo** web↔android (`5cfdf2c2` web offerer / `5399a70c` android), force_relay=true; first offer mto≈1145ms (web, relay_candidates=1), first answer mta≈2514ms (android, relay_candidates=0). Window max_mto=1717 / max_mta=4072 (healthy).

Web interval beacon at ~03:44:08Z reached ok=true with fin/fout=63/306; android best fin/fout=254/26 (above min_frames=10 both sides).

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| **PASS** | signaling OK: matches=4 offers=4 answers=4 |
| **PASS** | TURN media HOT max_rb=499562 peer_hot=17 |
| **PASS** | PRODUCT both directions: web fin/fout=63/306 android fin/fout=254/26 |

## Phone / adb (soft)

| Item | Value |
|------|--------|
| `adb` on PATH | **not found** this session — soft skip USB/network adb |
| Hub product beacons | android av_path present; **app_vc=375**, bind_v=1, policy=relay, hub_fr=1 |

No adb package assert this hop. Hub scorecard alone is enough: dual-direction frames + app_vc=375 from android beacons.

## Notes (honest)

- **verdict=PASS** (exit 0): signaling complete (4/4/4), TURN HOT, **product both directions**.
- **product.status=ok**, `done=true`. Web 63/306 and android 254/26 both clear min_frames=10; phone_to_pc=true and pc_to_phone=true.
- mto/mta within healthy bounds (max_mto=1717, max_mta=4072).
- force_relay aligned: hub=true, web=true, android=1/policy=relay → **fr_mismatch=false**.
- Last match is **web↔android 1v1 solo** (not multi-party). ICE path relay→relay on web; media plane OK (max_rb=499562, peer_hot=17, err_437=0).
- Mid-call android emitted several `zero_f_*` beacons while frames_out was still ramping (3→26) and briefly `v_readyState=ended` on two ticks; later recovered to live with fin=254 fout=26. Scorecard product gate still **ok** — reported as nuance, not multi/blur invent.
- last_answer_relay_candidates=0 on android answer line while offer had 1; still connected via relay policy and product frames landed — not treated as FAIL.
- **Explicit: not multi GOAL_MET** — this is **1v1 solo** A/V scorecard only. **No invent multi 3/4-way PASS.** Multi-party stage / partyCap / find-third not measured here.
- **No invent blur PASS** — blur not measured by this scorecard.
- vs L18 (stamp 20260812T033849Z WARN / product one-way / android 0/0): **recovered** to product.ok with real android fin/fout and app_vc=375; answers now match offers 4/4; last platforms web↔android (was web↔web only).
- Agents: read `verdict` **and** `product.status` in `latest.json`. Here both PASS/ok with done=true — 1v1 product path green; still not a multi-party ship claim.
- No human faces ≥30s claim; machine product.ok only.

## Not done (by design)

- No product / UI / mobile edits
- No deploy / `push.sh` / APK / AAB
- No invent multi PASS / multi GOAL_MET / blur PASS
- No skill / wiki compound (scorecard-only task)

## Connect risk

**None** — read-only hub journal scorecard via `av-verify.sh`. No ICE / pool / MediaSession / live.js / Android media touch.

## Files

- Task card (moved): `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L19e-av-verify.md`
- Repo RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L19e-av-verify-RESULT.md`
- Session RESULT: `/home/drakosik/tasks/grok-loop/done/L19e-av-verify-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp 20260812T034413Z)

## COMPLETE

**verdict=PASS · product.status=ok · done=true · max_mto=1717ms · max_mta=4072ms · web 63/306 · android 254/26 · fr_mismatch=false · app_vc=375 · matches/offers/answers 4/4/4.**  
1v1 solo only — **no invent multi PASS · no invent blur PASS.**
