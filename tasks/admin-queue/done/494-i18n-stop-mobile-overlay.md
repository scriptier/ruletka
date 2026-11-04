# i18n: same Stop/Next 3-way keys on Android overlay + packs

## Goal
Parity with web: add the 5 Stop/Next 3-way keys to mobile overlay + packs so a later Android label hop can use them.

## OWN
- `mobile/src/i18n/overlay/*.json`
- `mobile/src/i18n/packs/*.json`

## Keys
- `btn.stopLeaveCall`
- `btn.stopLeaveCallTitle`
- `btn.stopLeaveThird`
- `btn.stopLeaveThirdTitle`
- `btn.nextSoloTitle`

EN overlay already has `btn.stop`. Add the five new keys to **all** overlay + pack langs. Use the same meaning as `ui/i18n/en.json` / `ru.json`.

## Done
- [ ] All overlay + pack JSON files have the 5 keys
- [ ] Valid JSON
- [ ] RESULT + COMPLETE

## Must not
- live.tsx, LiveStageVideo, MediaSession, deploy, APK
- ui/i18n (sibling web task owns that)
