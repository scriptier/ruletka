# CONN-smoke-phone-avpath — RESULT

## Status
**COMPLETE** (verify-only smoke · read-only product code)

## OWN
- Phone exclusive adb: `-s 192.168.1.94:42227` (wireless Pixel 9 Pro; USB `45141FDAP0004F` = no-permissions)
- RUN: WebPair (`scripts/phone-web-pair.mjs`) + phone Start (`ruletka://live?autostart=1`); then `./scripts/av-verify.sh --min 10`
- WRITE: this RESULT
- **No** MediaSession / live.js / webrtc / live.tsx edits
- **No** deploy / invent multi PASS beyond scorecard / pool>0

## Goal
CONN-after-MX was **WARN / one-way** with **no android av_path** (web↔web only). Get phone in a match ≥20s with PC; re-run av-verify. Honest only.

## Device / package

| Field | Value |
|-------|--------|
| adb | `192.168.1.94:42227` device (wireless) |
| model | Pixel 9 Pro (caiman) |
| package | `me.ruletka.app` |
| versionName | **0.1.374** |
| versionCode | **382** (app_vc on av_path) |
| note | tip slightly newer than task expect ~0.1.373-vc381 post-MX — OK, smoke used installed tip |

## Smoke runs

### Run A — device-smoke SKIP_INSTALL + WEB_PAIR (first)
- cmd: `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=35 BUDGET_MS=90000 ./mobile/scripts/device-smoke.sh`
- ts: `20260812T063734Z`
- device-smoke verdict: **MATCHED** (signals=timer)
- UI dump caveat: final uiautomator captured **NotificationShade / QS** (not live stage) — timer MATCHED is weak alone
- web-pair log: mostly unmatched / Waiting after brief kick; page churn
- hub: android arm_0 at ~06:37:45; earlier residual 06:31 android answer + **zero_f_*** (ice stayed new/checking)

### Run A interim av-verify (`20260812T063916Z`)
| Field | Value |
|-------|--------|
| **verdict** | **WARN** |
| **product.status** | **no-media** |
| android av_path | **yes** (app_vc=382, then residual app_vc=381 in window) |
| platforms last | android ↔ web |
| fin/fout android | **0 / 0** |
| fin/fout web | **0 / 0** |
| ice | new / checking (never connected in parsed beacons) |
| force_relay | hub true · android 1 · policy relay · mismatch false |
| bind_v | 0 |

Honest: phone **was** in window with android av_path, but product **no-media** — not product.ok.

### Run B — manual long WebPair + phone autostart (sustained ≥20s)
- web: `BUDGET_MS=120000 node scripts/phone-web-pair.mjs`
- phone: force-stop → `ruletka://live?autostart=1` on wireless serial
- mid UI (~45s): focus `me.ruletka.app.MainActivity`; partner label **WebPair · ★0 · Canada · Calgary**; privacy veil copy present
- web-pair console: `connected relay→relay` with rising fin/fout (e.g. 389/456 → 670/776)
- match held long enough for multiple interval av_path beacons both sides

## Final scorecard (canonical)

- Live: `./scripts/av-verify.sh --min 10`
- Stamp: **20260812T064214Z**
- At: **2026-08-12T06:42:14Z**
- Window: last **10 min**
- Artifacts:
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.json`
  - `/home/drakosik/freenet-roulette/artifacts/av-verify/latest.md`
  - stamp: `artifacts/av-verify/20260812T064214Z.json`
  - HISTORY append via script
- Device smoke / pair logs:
  - `mobile/artifacts/device-smoke/` (ts 20260812T063734Z + last-verdict)
  - `mobile/artifacts/device-smoke/web-pair-20260812T0640-manual.log` (Run B)
  - `artifacts/device-smoke/CONN-smoke-phone-avpath-mid.png` (Run B mid shot if present)

### Verdict table

| Field | Value |
|-------|--------|
| **verdict** | **PASS** |
| **product.status** | **ok** |
| **product.done** | **true** |
| **android av_path** | **yes** |
| **app_vc** | **382** |
| **bind_v** | **1** |
| **product.ok invent?** | **NO** — from scorecard gates PASS PRODUCT both directions |
| **multi PASS invent?** | **NO** — 1v1 phone↔web only; multi not measured |
| hard_fail | false |
| signaling_ok | true |
| media_pass | true |

### Scorecard numbers

| Field | Value |
|-------|--------|
| matches / offers / answers | **4 / 3 / 3** |
| max_mto_ms | **1895** |
| max_mta_ms | **3122** |
| max_mti_ms | 3283 |
| last platforms | **web ↔ android** |
| last_force_relay | true |
| force_relay hub / web / android | true / true / **1** |
| android_policy | **relay** |
| force_relay_mismatch | **false** |
| web fin / fout | **670 / 776** |
| android fin / fout | **756 / 678** |
| phone_to_pc / pc_to_phone | **true / true** |
| TURN max_rb | 499165 |
| peer_hot / alloc_ok | 18 / 8 |
| coturn err_437 | 0 |
| av_path count / best fin / best fout | 16 / 756 / 776 |
| any_ok | true |
| last offer/answer relay_candidates | 1 / 0 |

### Product block (latest.json)

```json
{
  "status": "ok",
  "done": true,
  "min_frames": 10,
  "web_frames_in": 670,
  "web_frames_out": 776,
  "android_frames_in": 756,
  "android_frames_out": 678,
  "phone_to_pc": true,
  "pc_to_phone": true,
  "force_relay_hub": "true",
  "force_relay_web": true,
  "force_relay_android": 1,
  "android_policy": "relay",
  "force_relay_mismatch": false,
  "app_vc": 382,
  "bind_v": 1,
  "hub_fr_beacon": 1
}
```

### Gates

| Level | Message |
|-------|---------|
| **PASS** | signaling OK: matches=4 offers=3 answers=3 |
| **PASS** | TURN media HOT max_rb=499165 peer_hot=18 |
| **PASS** | PRODUCT both directions: web fin/fout=670/776 android fin/fout=756/678 |

## Compare to prior CONN-verify-after-mx

| Field | After-MX `20260812T062732Z` | Smoke final `20260812T064214Z` |
|-------|----------------------------|--------------------------------|
| verdict | WARN | **PASS** |
| product | one-way | **ok** |
| platforms | web ↔ web | **web ↔ android** |
| android av_path | **no** (app_vc=null) | **yes** (app_vc=382) |
| android fin/fout | 0/0 | **756/678** |
| web fin/fout | 451/446 | 670/776 |
| force_relay android | null | 1 (relay, aligned) |

Gap closed for this smoke window: phone in match, android beacons present, dual-direction frames under force_relay pure.

## Diagnosis notes (honest)

1. **Run A alone insufficient** — MATCHED timer + shade UI + interim no-media; do not ship on device-smoke MATCHED alone.
2. **Run B sustained** — phone foreground + WebPair ≥20s → ICE connected relay→relay both sides; bind_v 0→1 with frames.
3. Residual earlier in window (06:31) showed android answer then zero_f_* ice=new — fragile path still possible; final stamp is the success sample, not a claim every match is forever green.
4. pool stayed **0** (no thrash). No product code edits.

## NEXT_ROLE

| If | Role |
|----|------|
| Human wants ship confidence after this scorecard | **ship** (human faces optional; machine product.ok already) or stop thrash |
| Regression / black cam returns | re-**smoke** then **diagnose** from fresh av-verify |
| One-way with max_rb HOT | **client-ice** (not turn thrash) |
| Multi / find-third | separate multi harness — **not** claimed here |

**Recommended NEXT_ROLE:** **ship** (or idle) — CONN smoke goal met with scorecard product.ok + android av_path. Do **not** thrash MediaSession/live.js on this green stamp. Claude 450 path remains exclusive if still open.

## Must-not checklist

- [x] no MediaSession / live.js / webrtc / live.tsx edits
- [x] no deploy
- [x] no invent multi PASS
- [x] product.ok only because scorecard said ok (not invented)
- [x] pool=0 forever
- [x] if no device would have been BLOCKED — device was present wireless

## Done
RESULT with verdict=**PASS**, product=**ok**, android av_path=**yes** (app_vc=382 fin/fout 756/678), NEXT_ROLE=**ship**/idle.
