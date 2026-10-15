# Task: iOS you-tile mic/flip like mobile web (docs + optional LiveMoreSheet only)

## Spec
`knowledge/specs/current-ios-parity.md`

Web: cam/mic on YOU tile. Android 477: cluster on partner; bar still has mic/flip. For iOS, document the remaining gap. If you can add a compact mic/flip overlay **without** LiveStageVideo / liveStyles, do it in LiveMoreSheet only — otherwise docs.

## OWN
- `docs/IOS_DUO.md` (append) OR `mobile/src/live/LiveMoreSheet.tsx` if a tiny iOS-only row
- Prefer docs if LiveMoreSheet is already owned by 826

## Must not
LiveStageVideo.tsx, liveStyles.ts, MediaSession, live.tsx, deploy

## Done
- [ ] RESULT: remaining FAIL vs web (mic on you tile)
- [ ] RESULT contains **`COMPLETE`**
- [ ] Prefer docs; LiveMoreSheet only if 826 is not already owning that file
