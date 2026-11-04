# i18n: Stop/Next 3-way keys in remaining ui/i18n packs

## Goal
Fill missing keys so every `ui/i18n/*.json` pack has the new 3-way Stop/Next strings. EN+RU already have them.

## OWN
- `ui/i18n/*.json` (not `ui/i18n.js` unless a comment only)
- Do **not** edit `en.json` / `ru.json` except to add a missing key if a scan finds one

## Keys (copy sense, not English leftover)
- `btn.stopLeaveCall` — short button: Leave call
- `btn.stopLeaveCallTitle` — Leave — the others stay in the call
- `btn.stopLeaveThird` — short: Leave 3rd
- `btn.stopLeaveThirdTitle` — Leave this 3-way — they stay together as 1v1
- `btn.nextSoloTitle` — Leave and search on your own

## Done
- [ ] Every `ui/i18n/*.json` except meta.json has all 5 keys
- [ ] Valid JSON (`python3 -m json.tool` each file)
- [ ] RESULT + COMPLETE
- [ ] No invent MULTI_PASS

## Must not
- MediaSession, live.js, live.tsx, deploy, APK, pool>0
- Rewrite unrelated keys
