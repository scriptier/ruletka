# 054 — Sync blur/privacy i18n overlays (non-EN/RU)

## Status
COMPLETE

## What changed
Brought all mobile overlay packs in line with the EN/RU source of truth for the
blur-mode + home-tip strings: default is **Off** (fastest connect), not
Brief/Hold. Updated the five blur keys, added the missing `blurModeSaved`
key, and added an accurate `mobile.home.liveTips` key to every pack.

Keys touched per pack:
- `mobile.settings.blurStrangers`
- `mobile.settings.blurStrangersHint`
- `mobile.settings.blurModeOff`
- `mobile.settings.blurModeIntro`
- `mobile.settings.blurModeHold`
- `mobile.settings.blurModeSaved` (new)
- `mobile.home.liveTips` (new)

## Packs touched
- **Fixed wrong "default" copy** (previously claimed Brief/intro was default):
  `ar`, `bg`, `cs`, `de`, `es`, `fr`, `pl`, `pt`, `uk` — updated the 5 existing
  blur keys to correct/translated text, added `blurModeSaved` + `liveTips`.
- **Added full block** (previously had no blur/liveTips keys at all, silently
  fell back to correct EN text via `i18n/index.tsx`): `sr`, `tr`, `zh` — added
  all 7 keys translated into Serbian/Turkish/Chinese so users see localized
  copy instead of an English fallback.
- **Untouched**: `en.json` (already correct source of truth), `ru.json`
  (already had all 7 keys correct — not modified).

## Files touched
- `mobile/src/i18n/overlay/ar.json`
- `mobile/src/i18n/overlay/bg.json`
- `mobile/src/i18n/overlay/cs.json`
- `mobile/src/i18n/overlay/de.json`
- `mobile/src/i18n/overlay/es.json`
- `mobile/src/i18n/overlay/fr.json`
- `mobile/src/i18n/overlay/pl.json`
- `mobile/src/i18n/overlay/pt.json`
- `mobile/src/i18n/overlay/sr.json`
- `mobile/src/i18n/overlay/tr.json`
- `mobile/src/i18n/overlay/uk.json`
- `mobile/src/i18n/overlay/zh.json`

No edits to `mobile/app/*`, `mobile/src/media/*`, or any WebRTC/connect code.

## Verify commands run
```
python3 -c "import json; json.load(open('<each file>.json'))"   # all 14 packs parse OK
grep -RniE '"mobile.settings.blurMode(Intro|Hold)":\s*"[^"]*default' mobile/src/i18n/overlay/*.json   # no matches — nothing claims intro/hold as default
```
Manually diffed each pack against `en.json`/`ru.json` to confirm all 7 keys
present and consistent in meaning (off = default/fastest; brief = ~2.5s;
hold = until tap).

## Connect risk
none — i18n string-only change, no logic, no `mobile/app/*`, no media/WebRTC
files touched.

COMPLETE
