# 404 — i18n: partyCap max 3 + find-3rd looking strings consistency

## Status
COMPLETE

## Summary
- `ui/i18n/*.json` (all 14 langs) and `ui/i18n.js` already said "max 3 opponents" for `log.partyCap` — no change needed there.
- `mobile/src/i18n/packs/*.json` still had `log.partyCap` at "max 2 opponents" (and localized equivalents) in all 14 language packs. Updated each to "max 3 opponents", matching the wording already used in `ui/i18n`.
- `trio.slotEmpty` ("Looking for a 3rd…" / "Ищем третьего…") and the rest of the `trio.*` find-third strings already exist in both EN and RU for `ui/i18n` and `mobile/src/i18n/packs` — no gap found, no changes needed.
- Checked `mobile/src/i18n/overlay/*.json` for `partyCap`/`max 2`/`opponents` overrides — none present.

## Files touched
- mobile/src/i18n/packs/ar.json
- mobile/src/i18n/packs/bg.json
- mobile/src/i18n/packs/cs.json
- mobile/src/i18n/packs/de.json
- mobile/src/i18n/packs/en.json
- mobile/src/i18n/packs/es.json
- mobile/src/i18n/packs/fr.json
- mobile/src/i18n/packs/pl.json
- mobile/src/i18n/packs/pt.json
- mobile/src/i18n/packs/ru.json
- mobile/src/i18n/packs/sr.json
- mobile/src/i18n/packs/tr.json
- mobile/src/i18n/packs/uk.json
- mobile/src/i18n/packs/zh.json

## Verify commands run
- `grep -rn "partyCap" ui/i18n/*.json mobile/src/i18n/packs/*.json mobile/src/i18n/overlay/*.json`
- `grep -rn '2 opponents\|2 Gegner\|2 adversaires\|2 oponentes\|2 protivníci\|максимум 2\|макс\. 2\|максимально 2\|2 rakip\|2 名对手\|2 من المعارضين\|2 przeciwników' ui/i18n mobile/src/i18n` — only stale hits left in `ui/i18n/.mt-cache/` (translation cache, not shipped strings; untouched).
- `for f in mobile/src/i18n/packs/*.json ui/i18n/*.json; do python3 -c "import json; json.load(open('$f'))"; done` — all valid JSON.

## Done criteria
- [x] No "max 2 opponents" left in partyCap keys (shipped packs)
- [x] trio.slotEmpty present EN/RU (already existed, both ui and mobile)
- [x] RESULT + COMPLETE
- [x] No deploy

## Connect risk
none — i18n string-only change, no MediaSession/ICE/APK touched.

COMPLETE
