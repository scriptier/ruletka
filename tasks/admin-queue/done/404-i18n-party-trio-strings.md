# i18n: partyCap max 3 + find-3rd looking strings consistency

## Goal
All ui/i18n/*.json and mobile packs that still say max 2 opponents → max 3. Ensure trio.slotEmpty / looking strings exist in EN/RU at minimum.

## OWN
- `ui/i18n.js` (partyCap only if needed)
- `ui/i18n/*.json`
- `mobile/src/i18n/packs/en.json` + `ru.json` (and overlay if needed for mobile.party)

## Done criteria
- [ ] No "max 2 opponents" left in partyCap keys
- [ ] trio.slotEmpty present EN/RU
- [ ] RESULT + COMPLETE
- [ ] No deploy

## Must not
- MediaSession, ICE, APK
