# 512 — Android privacy veil tap-anywhere copy audit — RESULT

## Status
COMPLETE

## What was found
`mobile.live.blurTapAnywhere` and `mobile.live.blurTapAnywhereHint` (used by the
privacy-veil overlay in `mobile/app/live.tsx`) existed only in
`mobile/src/i18n/overlay/en.json`. No other locale overlay had them (verified
via grep across all 14 `overlay/*.json` files and all 14 `packs/*.json` files —
0 hits outside `en`). `mobile/src/i18n/index.tsx` falls back to the English
overlay string for any missing key, so there was no runtime crash risk, but
non-English users were silently seeing English copy for this string.

## Fix
Added native translations for both keys to the two overlays that already had
sibling `mobile.live.blur*` copy but were missing this pair, keeping en + 2
locales covered:
- `mobile/src/i18n/overlay/ru.json`
- `mobile/src/i18n/overlay/es.json`

Inserted alphabetically between `blurShort` and `blurTitle`, matching the
existing key ordering convention in those two files.

## Files touched
- mobile/src/i18n/overlay/ru.json (+2 keys)
- mobile/src/i18n/overlay/es.json (+2 keys)

## Verify commands run
- `node -e "JSON.parse(require('fs').readFileSync('ru.json','utf8')); JSON.parse(require('fs').readFileSync('es.json','utf8'))"` — both parse OK.
- `grep -n '"mobile.live.blurTapAnywhere' mobile/src/i18n/overlay/{en,ru,es}.json` — confirms all three now have both keys.
- Confirmed no `mobile-overlay.ts` regeneration needed — it `require()`s the overlay JSON files directly at build time.
- Confirmed via `mobile/app/live.tsx` grep that these keys back the live "Privacy veil" tap-anywhere body/hint text and the SoftBlur remote accessibility hint text; no SoftBlur enable/config code was touched, only copy.

## Note
The worktree already had unrelated pending (uncommitted) changes across most
`mobile/src/i18n/overlay/*.json` and other files before this task started
(visible in `git status` at session start). Only `ru.json` and `es.json` were
touched by this task, and only to add the two `blurTapAnywhere*` keys — no
other lines in those files were changed by me.

## Connect risk
none — copy-only change in i18n overlay JSON, no touch to MediaSession,
SoftBlur enablement, ICE/TURN, offer/answer, or CONNECTIVITY_LOCK paths.

COMPLETE
