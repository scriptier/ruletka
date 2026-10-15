# i18n: Android overlay has btn.stopLeave* in all langs (already added)

## Goal
Confirm every `mobile/src/i18n/overlay/*.json` and `packs/*.json` still has:
btn.stopLeaveCall, btn.stopLeaveCallTitle, btn.stopLeaveThird, btn.stopLeaveThirdTitle, btn.nextSoloTitle
If any pack missing, add it. Do not invent new key names.

## OWN
- `mobile/src/i18n/overlay/*.json`
- `mobile/src/i18n/packs/*.json`

## Done
- [ ] python scan 0 missing
- [ ] valid JSON
- [ ] RESULT + COMPLETE

## Must not
- live.tsx, LiveBottomBar, MediaSession, ui/i18n
