# 493 — i18n: Stop/Next 3-way keys in remaining ui/i18n packs — RESULT

## Status
COMPLETE

## Files touched
- `ui/i18n/ar.json`
- `ui/i18n/bg.json`
- `ui/i18n/cs.json`
- `ui/i18n/de.json`
- `ui/i18n/es.json`
- `ui/i18n/fr.json`
- `ui/i18n/pl.json`
- `ui/i18n/pt.json`
- `ui/i18n/sr.json`
- `ui/i18n/tr.json`
- `ui/i18n/uk.json`
- `ui/i18n/zh.json`

Each pack now has, in the same position as en.json/ru.json (4 keys inserted right
after `btn.stop`, `btn.nextSoloTitle` inserted right after `btn.stopTitle`):
- `btn.stopLeaveCall`
- `btn.stopLeaveCallTitle`
- `btn.stopLeaveThird`
- `btn.stopLeaveThirdTitle`
- `btn.nextSoloTitle`

Translations were written by sense (matched tone/register of each pack's
existing `btn.next*` / `btn.stop*` strings), not copied from English.

`en.json` and `ru.json` already had all 5 keys — not touched.
`meta.json` — out of scope per task, not touched.
`home-en.json` — checked; it has no `btn.*` namespace at all (it's the
English-only landing-page copy pack, unrelated to the live-call button
strings), so it was left alone rather than force-adding unrelated keys.

## Verify commands run
```
python3 -m json.tool <file>   # for every ui/i18n/*.json — all OK
```
Also scripted a check confirming all 5 keys present in every pack except
meta.json/home-en.json (see note above on home-en.json).

## Connect risk
none — i18n JSON only, no touches to live.js/live.tsx/MediaSession/hub/ICE/TURN.

COMPLETE
