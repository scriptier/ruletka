# W8 multi-party skill ship stamp 386 — RESULT

## Status
**COMPLETE**

## Goal
Skill ship tip aligned to disk after W5/W6 (and concurrent stage work). Stamps only.

## OWN
- `.grok/skills/multi-party-stage/SKILL.md` only

## Disk truth (re-read before write)

| Pin | Disk source | Value |
|-----|-------------|--------|
| APK | `mobile/app.json` + `mobile/artifacts/ruletka-0.1.366-vc374.apk` | **0.1.366-vc374** |
| live.js | `ui/live.html` preload L397 + script L3032 | **`?v=561`** |
| webrtc.js | `ui/live.html` L3031 | **`?v=315`** |
| live-stage.css | `ui/live.html` L395 | **`?v=385`** (not 386) |

Confirm:

```text
live-stage.css?v=385
live.js?v=561
webrtc.js?v=315
0.1.366 374
```

**Honest stage note:** task card title/goal said stage **v=386**, but disk `ui/live.html` still pins **`live-stage.css?v=385`**. Skill follows **read disk** — does **not** invent 386.

## What changed (skill)

1. **Ship stamps line** restated with re-read sources (`ui/live.html` + `app.json` / artifacts).
2. Numeric pins **unchanged** (already matched disk):
   - APK **0.1.366-vc374**
   - `live.js?v=561`
   - `webrtc.js?v=315`
   - `live-stage.css?v=385`
3. **Smoke honesty** added under ship stamps:
   - Human multi / find-3rd smoke **OPEN** — no multi PASS invent.
   - Agent phone **1v1 MATCHED** (APK 0.1.366-vc374 · WEB_PAIR · T1 `20260812T021127Z`) OK to mention as **non-multi only** — does not close multi smoke.

## Smoke honesty (detail)

| Claim | Status | Source |
|-------|--------|--------|
| Human multi / find-3rd | **OPEN** | No multi PASS / GOAL_MET |
| Agent phone 1v1 device-smoke | **MATCHED** (non-multi) | `T1-phone-device-smoke-web-pair-RESULT.md` · `20260812T021127Z` · exit 0 · APK 0.1.366-vc374 |

## Not done (by design)

- No product code / UI / mobile edits
- No deploy / APK / AAB
- No git push
- No invent stage **386** while html still **385**
- No invent multi smoke PASS

## Files

- `/home/drakosik/freenet-roulette/.grok/skills/multi-party-stage/SKILL.md`
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W8-skill-stamp-386-RESULT.md`

## Verify

```bash
# disk pins
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' ui/live.html | head
python3 -c "import json; d=json.load(open('mobile/app.json')); print(d['expo']['version'], d['expo']['android']['versionCode'])"
ls mobile/artifacts/ruletka-0.1.366-vc374.apk

# skill pins must match disk + smoke honesty
grep -nE '0\.1\.366|live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=|Smoke honesty|1v1 MATCHED|multi smoke' \
  .grok/skills/multi-party-stage/SKILL.md
```

Expected skill: **561 / 315 / 385 / 0.1.366-vc374**; multi **OPEN**; phone 1v1 MATCHED noted as non-multi.

## Connect risk

**None** — skill stamp + honesty note only. No ICE / pool / MediaSession / live.js / webrtc / Android media touch.

## COMPLETE

Skill ship stamps match disk (**stage 385**, not 386). Human multi smoke open. Agent phone 1v1 MATCHED noted as non-multi only.
