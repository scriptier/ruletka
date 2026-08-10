# Task: Fill search queue i18n keys in remaining overlays

## Goal
`mobile.live.queueJoining`, `queueInPool`, `queueConfirming` (and `waitLine` if missing) exist in en/ru. Copy/adapt into other overlay langs under `mobile/src/i18n/overlay/*.json` (uk, pl, cs, bg, sr, de, es, fr, pt, tr, ar, zh). Prefer short natural translations; EN fallback is OK for hard ones but try native.

## Scope
- `mobile/src/i18n/overlay/*.json` only (not en/ru if already present)

## Done criteria
- [ ] Keys present in all overlay packs
- [ ] JSON valid
- [ ] RESULT + COMPLETE

## Do not
- live.tsx / connect / deploy
