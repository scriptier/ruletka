# Next-hop status — 2026-08-10 (ROLE: measure-push)

## APK version

- **0.1.304** (vc312)
- Path: `/home/drakosik/freenet-roulette/mobile/artifacts/ruletka-0.1.304-vc312.apk`
- Size / mtime: 57628048 bytes (~55 MiB), Aug 10 17:28

## ADB push result

- `adb devices -l`: **no devices attached**
- APK push: **skipped** (soft-fail — device offline)
- Intended when device online:
  - `adb push` → `/sdcard/Download/ruletka-0.1.304-vc312.apk`
  - also → `/sdcard/Download/ruletka-latest.apk`
  - install (`adb install -r`) only if human asks; prefer Download push only

## Hub metrics (`timeout 40 ./scripts/hub-match-speed.sh`)

| metric | value |
|--------|------:|
| matches | 4 |
| offers | 3 |
| answers | 3 |
| offer drops | 0 |
| answerer first-path grace drops | 0 |
| android SLOW first-offers | 0 |
| slow offers (>2000ms) | 0 |
| **max match_to_offer_ms (mto)** | **1749** |
| mto source | hub field |
| slow answers (>2000ms) | 2 |
| **max match_to_answer_ms (mta)** | **4097** |
| mta source | hub field |
| slow ice (>5000ms) | 0 |
| max match_to_ice_ms (mti) | 3938 |
| mti source | hub field |

**Hub verdict: WARN** — match_to_answer_ms over budget (max mta=4097; budget &lt;2000). mto OK (1749 &lt; 2000).

## Next (human)

1. Attach phone → push APK 0.1.304 to Download (and/or install)
2. Deploy UI (human — no auto-deploy from this hop)
3. Smoke per `SMOKE-NEXT.md` (Play↔PC); re-run hub-match-speed after

## Notes

- No deploy. No code edits beyond this raw status file.
- ROLE: measure-push DONE adb=none hub=WARN mto=1749 mta=4097
