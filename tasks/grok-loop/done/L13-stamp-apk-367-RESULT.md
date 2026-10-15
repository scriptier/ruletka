# L13-stamp-apk-367 — RESULT

## Status
**COMPLETE** (ship tip restamp only — **no invent multi / blur / Friends / Settings PASS**)

## Goal
OWN **SMOKE-NEXT.md** + **FINISH-PLAY-MULTI.md** tips only.  
Stamp **APK 0.1.367-vc375**, **live.js from disk (564+)**, multi/blur **human-smoke-open**, spin SFX **deployed**.

## OWN
- `knowledge/specs/SMOKE-NEXT.md`
- `knowledge/specs/FINISH-PLAY-MULTI.md`
- RESULT under `tasks/grok-loop/done/`
- **No** product / UI / mobile / deploy / APK rebuild this hop

## Disk truth (re-read before write)

| Pin | Source | Value |
|-----|--------|--------|
| APK version | `mobile/app.json` | **0.1.367** / versionCode **375** |
| APK artifact | `mobile/artifacts/ruletka-0.1.367-vc375.apk` + `ruletka-latest.apk` | present · aapt **versionName='0.1.367' versionCode='375'** |
| live.js | `ui/live.html` L397 / L3032 | **`?v=564`** |
| webrtc.js | `ui/live.html` L3031 | **`?v=315`** |
| live-stage.css | L395 | **`?v=387`** |
| live-brand.css | L396 | **`?v=11`** |
| match.mp3 | `ui/sounds/match.mp3` | 15165 B · md5 **`b858bc2e622f3c051e0958baa0c3043a`** |
| blur source | `mobile/app/live.tsx` | `blurWantAutoRef` / `applyMatchBlurVeil` present; mtime **before** APK 0.1.367 build |
| AAB tip | `mobile/artifacts/*.aab` | **MISSING** for 0.1.367 (≤0.1.3 only) |

Confirm:

```text
live-stage.css?v=387
live-brand.css?v=11
live.js?v=564
webrtc.js?v=315
0.1.367 375
```

## Prod truth (curl 2026-08-12T03:14Z UTC)

| Check | Prod VIP | Disk | Verdict |
|-------|----------|------|---------|
| `live.js?v=` | **564** | **564** | match |
| `live-stage.css?v=` | **386** | **387** | prod lags 1 |
| `live-brand.css?v=` | **11** | **11** | match |
| `webrtc.js?v=` | **315** | **315** | match |
| `sounds/match.mp3?v=1` | HTTP **200** audio/mpeg | present | **SFX deployed** |

## What changed

### `knowledge/specs/SMOKE-NEXT.md`
1. UX ship tip → **APK 0.1.367-vc375** + **live.js?v=564** + webrtc **315** + stage **387** + brand **11**.
2. Install / C / D / E / F paste templates retargeted to **0.1.367-vc375** / **564**.
3. Agent notes: historical 1v1 MATCHED kept on **0.1.366-vc374**; L13 prod re-curl row (live.js/brand match; stage 386 lag; match.mp3 deployed); blur **code-shipped · human-smoke-open**.
4. All human boxes remain **unchecked** (52 open / 0 checked). Multi/blur **human-smoke-open**.

### `knowledge/specs/FINISH-PLAY-MULTI.md`
1. Progress stamp → Grok **L13-stamp-apk-367**.
2. Ship tip table: APK **0.1.367-vc375** (aapt), live.js **564**, stage **387**, brand **11**, match SFX **deployed**.
3. Ship stamps + residual honesty + evidence row for this RESULT.
4. D1/D2 AAB/version tip → **0.1.367 / vc375**; multi A1–A5 + blur still **human-smoke-open**.

## Explicit non-claims (no invent PASS)

| Claim | Verdict |
|-------|---------|
| Multi 3-way / 4-way / find-3rd GOAL_MET | **NOT claimed** — human-smoke-open |
| Blur Off/Intro/Hold mid-match product PASS | **NOT claimed** — human-smoke-open |
| Friends / Settings full Play GOAL_MET | **NOT claimed** — human-smoke-open |
| Agent 1v1 re-MATCHED on 0.1.367 | **NOT claimed** — historical MATCHED is **0.1.366-vc374** |
| Stage CSS fully deployed (387 on prod) | **NOT claimed** — prod still **386** |
| Play Console / AAB upload | **NOT claimed** — AAB MISSING for tip |
| Checked any human SMOKE boxes | **none** (52 open / 0 checked) |

## Not done (by design)

- No product code / UI / mobile edits
- No APK rebuild / AAB / deploy / git push
- No adb multi or blur smoke PASS
- No invent multi / blur / Friends / Settings GOAL_MET

## Files

- `/home/drakosik/freenet-roulette/knowledge/specs/SMOKE-NEXT.md`
- `/home/drakosik/freenet-roulette/knowledge/specs/FINISH-PLAY-MULTI.md`
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/L13-stamp-apk-367-RESULT.md` (this RESULT)
- Card: `tasks/grok-loop/running/L13-stamp-apk-367.md` → move to `done/`

## Verify

```bash
# disk pins
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=|live-brand\.css\?v=' ui/live.html | head
python3 -c "import json; d=json.load(open('mobile/app.json')); print(d['expo']['version'], d['expo']['android']['versionCode'])"
$ANDROID_HOME/build-tools/35.0.0/aapt dump badging mobile/artifacts/ruletka-0.1.367-vc375.apk | head -1

# specs match tip
grep -nE '0\.1\.367|vc375|live\.js\?v=564|live-stage\.css\?v=387|human-smoke-open' \
  knowledge/specs/SMOKE-NEXT.md knowledge/specs/FINISH-PLAY-MULTI.md | head -40

# human boxes still open
grep -c '^\- \[ \]' knowledge/specs/SMOKE-NEXT.md   # 52
grep -c '^\- \[x\]' knowledge/specs/SMOKE-NEXT.md  # 0
```

Expected: **0.1.367-vc375 / 564 / 315 / 387 / 11**; multi+blur **human-smoke-open**; SFX deployed; no invent PASS.

## Connect risk

**None** — docs ship-tip restamp only. No ICE / pool / MediaSession / live.js body / webrtc / Android media touch.

## COMPLETE

**COMPLETE.** SMOKE + FINISH ship tips stamped to disk: **APK 0.1.367-vc375**, **live.js?v=564**, stage **387**, brand **11**, webrtc **315**. Multi / blur remain **human-smoke-open**. Spin SFX **deployed** (prod match.mp3 HTTP 200). **No invent PASS.**
