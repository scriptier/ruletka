# Note: GiftFxOverlay particle density review (read-only)

## Goal
Short RESULT-only audit of particle/spec counts in `mobile/src/stars/GiftFxOverlay.tsx` for overnight density awareness. **No code changes.**

## OWN
- RESULT file only under `tasks/admin-queue/done/` — read-only review of:
  - `mobile/src/stars/GiftFxOverlay.tsx`

## Do (read-only)
1. List each emitter/spec builder and its particle count constants (e.g. confetti `n`, balloons `n`, firework bursts × sparks, `floatSpecs` call sites with `count`, barCount if relevant)
2. Note any path that looks heavy for low-end Android (rough total simultaneous nodes if all fire)
3. One-line recommendation only if density looks extreme — **do not change code**

## Must not
- Edit any source (GiftFxOverlay, live.tsx, LiveStageVideo, etc.)
- Deploy, APK, ICE thrash

## Done
- RESULT only with table of counts + Status COMPLETE + connect risk none
