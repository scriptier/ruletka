# Android tap-face — strengthen verify-match-ux asserts

## Goal
Extend `mobile/scripts/verify-match-ux.mjs` tap-a-face block so it fails if wiring is dead (helpers defined but never called).

## OWN
- `mobile/scripts/verify-match-ux.mjs` only

## Must not
- live.tsx, LiveStageVideo, MediaSession, APK, deploy

## Add asserts (keep existing 531 ones)
1. `LiveStageVideo.tsx` calls `onSelectPartner("primary")` AND `onSelectPartner("extra0")` AND `onSelectPartner("extra1")` (not just the prop type).
2. `peelOrSelectPrimary` or `onSelectPartner("primary")` appears inside a Pressable `onPress` / SwipeSkip `onTap` — at least one real call site besides the function definition.
3. `live.tsx` has `onSelectPartner=` (prop passed to LiveStageVideo).
4. `matchContinuity.ts` exports `extraPartnerActionTarget`.
5. First VideoView `key="live-first-remote"` still present (already asserted).

If siblings have not landed yet, asserts MAY fail — that is OK. Do not weaken them.

## Done
Run `node mobile/scripts/verify-match-ux.mjs` and paste L0 counts in RESULT + COMPLETE.
No MULTI_PASS.
