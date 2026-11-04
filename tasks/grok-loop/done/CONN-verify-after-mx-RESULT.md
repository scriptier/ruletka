# CONN-verify-after-mx — RESULT

## Status
**COMPLETE** (verify-only)

## OWN
- Script: `./scripts/av-verify.sh --min 10` only
- WRITE: this RESULT under `tasks/grok-loop/done/`
- optional one-line stamp on `knowledge/specs/CONNECT-IMPROVE-PLAN.md` progress only
- **No** MediaSession / live.js / webrtc / live.tsx edits
- **No** deploy / APK / pool>0
- **No invent multi PASS / GOAL_MET / product.ok** without scorecard

## Goal
After MX1–MX5 multi MediaSession/live changes + soft blur matrix closed 1v1: re-score hub product + android av_path + mto/mta residual. Honest only.

## Source
- Live run: `cd /home/drakosik/freenet-roulette && ./scripts/av-verify.sh --min 10`
- Shell exit: **3** (WARN)
- Stamp: **20260812T062732Z**
- At: **2026-08-12T06:27:32Z**
- Window: last **10 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp file: `artifacts/av-verify/20260812T062732Z.json`

## Verdict (honest)

| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **one-way** |
| **product.done** | **false** |
| **android av_path** | **no** (app_vc=null · bind_v=null) |
| **product.ok invent** | **NO** — scorecard says one-way |
| **multi PASS invent** | **NO** — not measured; web↔web 1v1 harness only |
| **linking-speed GOAL_MET** | **NO** |

## Scorecard table

| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **one-way** |
| **product.done** | **false** |
| **hard_fail** | false |
| **signaling_ok** | true |
| **media_pass** | true |
| matches / offers / answers | **2 / 2 / 2** |
| **max_mto_ms** (match→offer) | **1342** |
| **max_mta_ms** (match→answer) | **5793** |
| max_mti_ms (match→ice) | 5779 |
| last match platforms | **web ↔ web** |
| last_force_relay | true |
| **force_relay_mismatch** | **false** |
| force_relay hub / web / android | true / true / **null** (policy=null) |
| **app_vc** | **null** |
| bind_v | null |
| web fin / fout | **451 / 446** |
| android fin / fout | **0 / 0** |
| phone_to_pc / pc_to_phone | true / false *(scorecard labels; no android side)* |
| TURN max_rb | 365504 |
| TURN peer_hot / alloc_ok | 5 / 2 |
| coturn err_437 | 0 |
| av_paths (window) | 40 *(all web in parsed product path)* |
| av_path best fin/fout | 451 / 446 |
| last offer/answer relay_candidates | **1 / 0** |

## Product block (from latest.json)

```json
{
  "status": "one-way",
  "done": false,
  "min_frames": 10,
  "web_frames_in": 451,
  "web_frames_out": 446,
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

## mto / mta residual

| Metric | Overnight `20260812T051553Z` | After-MX `20260812T062732Z` | Gate / note |
|--------|------------------------------|-----------------------------|-------------|
| **max_mto** | **1633** | **1342** | WARN if >8000 — OK; lower than overnight residual |
| **max_mta** | **3697** | **5793** | WARN if >10000 — OK; **higher** than overnight residual |
| max_mti | 3681 | 5779 | informational |
| platforms | android ↔ web | **web ↔ web only** | no phone sample this window |
| product | **ok** (android 32/6) | **one-way** (android 0/0) | not comparable 1:1 without phone |

Last match (~06:27:00Z): solo web↔web (`3c366fd9` / `f3577a4f`), force_relay=true; first offer mto≈1342ms (relay_candidates=1), first answer mta≈3466ms (relay_candidates=0). Window max_mta=5793 from earlier pair in 10m window.

**Not** linking-speed GOAL_MET — residual still open; mta worse on this web↔web sample; no android dual-direction product.

## Gates (from latest.json)

| Level | Message |
|-------|---------|
| **PASS** | signaling OK: matches=2 offers=2 answers=2 |
| **PASS** | TURN media HOT max_rb=365504 peer_hot=5 |
| **WARN** | PRODUCT one-way (PC→phone weak): web fin/fout=451/446 android fin/fout=0/0 |

## Diagnosis letter (this stamp — not invent MX 1v1 break)

| Letter | Meaning | Fit now |
|--------|---------|---------|
| **(A)** | No Android in window / no av_path from phone | **YES this window** — app_vc=null · android fin/fout=0/0 · last platforms web↔web |
| **(B)** | Phone matched but frames_out=0 (encode/bind dead) | **NO proof** — no android beacon at all; cannot claim MX MediaSession encode death from this sample |
| **(C)** | Harness noise | **PARTIAL** — web↔web frames HOT (451/446) proves web media plane OK; multi-pair user labels not observed in tail as multi-party |

**Honest read:** After-MX 10m window is **android silence (A)**, not a machine proof that MX multi MediaSession regressed 1v1 dual A/V. Overnight `20260812T051553Z` still stands as last **product.ok** (app_vc=376 · android 32/6). This re-score **does not** re-assert product.ok and **does not** invent multi PASS.

## vs overnight product.ok (prior stamp)

| Field | Overnight `20260812T051553Z` | After-MX `20260812T062732Z` |
|-------|------------------------------|-----------------------------|
| verdict | **PASS** | **WARN** |
| product | **ok** done=true | **one-way** done=false |
| web fin/fout | 3851 / 4257 | 451 / 446 |
| android fin/fout | **32 / 6** | **0 / 0** |
| android av_path | **yes** app_vc=**376** | **none** |
| matches/offers/answers | 2 / 2 / 2 | 2 / 2 / 2 |
| max_mto / max_mta | 1633 / 3697 | **1342 / 5793** |
| last platforms | android ↔ web | web ↔ web |
| TURN | HOT 518150 | HOT 365504 |

## NEXT_ROLE

**smoke**

Why:
1. Product **one-way** with **no android av_path** → re-open **(A)** for *this* window only; first fix is human phone + PC Start once ≥20s (tip APK if denser fout/hop10 arm wanted), **not** coturn thrash.
2. TURN **HOT** + signaling balanced → **not** turn-media; **not** pool; **not** invent client-ice encode death without phone beacon.
3. After phone is back in journal with product.ok, residual for speed remains **web-kick / P4** (mto/mta + answer relay_candidates=0) — overnight residual still the speed bar; this window mto improved (1342) but mta **5793** worse and no dual product.
4. MX multi regression on 1v1: **unproven** until android↔web sample returns; if phone present + fout=0 → then **client-ice / android-answer**, not smoke.

## GOAL_MET

| Claim | This stamp |
|-------|------------|
| product.ok | **NO** (status=one-way done=false) |
| android av_path present | **NO** |
| multi 3/4-way PASS | **NO invent** |
| blur PASS | **NO invent** (not measured) |
| linking-speed GOAL_MET | **NO** |
| human faces ≥30s | **no claim** |

## DO_NOT (honored)

- No MediaSession / live.js / webrtc / live.tsx edit
- No deploy / APK / pool>0
- No invent product.ok / multi PASS / GOAL_MET beyond scorecard
- No coturn thrash while max_rb HOT

## Commands run

```bash
./scripts/av-verify.sh --min 10
# exit 3 · verdict WARN · product.status=one-way · android av_path absent
```

## Files

- Task card (moved): `/home/drakosik/freenet-roulette/tasks/grok-loop/done/15-CONN-verify-after-mx.md`
- RESULT: `/home/drakosik/freenet-roulette/tasks/grok-loop/done/CONN-verify-after-mx-RESULT.md`
- Scorecard: `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json` (stamp **20260812T062732Z**)
- Prior product.ok reference: stamp **20260812T051553Z** / `CONN-overnight-verify-RESULT.md`

## COMPLETE

**verdict=WARN · product.status=one-way · done=false · android av_path=NO · app_vc=null · max_mto=1342ms · max_mta=5793ms · web 451/446 · android 0/0 · fr_mismatch=false · matches/offers/answers 2/2/2 · TURN HOT · NEXT_ROLE=smoke.**  
1v1 scorecard only — **no invent product.ok · no invent multi PASS · no invent MX 1v1 break without phone sample.**
