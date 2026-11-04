# 829 — iOS rules / 18+ screen — RESULT

**Status:** COMPLETE

## What changed
`mobile/app/rules.tsx` was already at parity with Android visually (badge, rules card,
block/report + no-minors lines, CTA/secondary/link buttons) from prior work in this
worktree. This task closed the remaining iOS gaps:

1. **Safe area under notch** — added `useSafeAreaInsets()` and applied
   `paddingTop: Math.max(insets.top, 24)` to the `ScrollView` `contentContainerStyle`
   on both the `age` step and the `perm` step, so content clears the notch / Dynamic
   Island instead of sitting under it. `styles.root` was split into
   `paddingHorizontal`/`paddingBottom` (unchanged 24) plus the dynamic `paddingTop`.
2. **No Android-only copy on iOS** — `mobile.perm.firstRunHint` ("...then **Android**
   will ask.") is now swapped for an iOS-specific string on `Platform.OS === "ios"`,
   via a local `tf()` i18n-with-fallback helper (same pattern already used in
   `settings.tsx` for `pushBatteryTipIos`, so no new key had to be added to all 14
   language packs).
3. Same fix applied to `mobile/src/permissions/PermissionRationaleCard`'s
   `mobile.perm.screenBody` ("Next, **Android** will show system permission
   dialogs...") — this component is only ever rendered from `rules.tsx`'s `perm`
   step (verified via grep, no other usage), so it's effectively part of this
   screen's flow even though it lives in a separate file.
4. Confirmed there is no battery-optimization copy anywhere in the rules/perm flow
   (that copy only exists in `settings.tsx`, out of scope) — nothing to hide there.

`declineUnder18()` already branched correctly (Android: `BackHandler.exitApp()`,
iOS: opens child-safety URL) — left as-is.

## Files touched
- `mobile/app/rules.tsx` (OWN)
- `mobile/src/permissions/PermissionRationale.tsx` (shared subcomponent, only used
  by rules.tsx — touched to finish the "no Android-only copy" requirement)

## Verify commands run
- `npx tsc --noEmit` (mobile/) — pre-existing unrelated errors elsewhere in the repo
  (missing native module types in live.tsx/friends.tsx/settings.tsx etc., not
  caused by this change); **zero errors** in `rules.tsx` or `PermissionRationale.tsx`.
- Confirmed `react-native-safe-area-context` is already a declared dependency
  (`mobile/package.json`) and already used the same way in `live.tsx`, `friends.tsx`,
  `_layout.tsx`.
- Manual grep of all i18n keys reachable from `rules.tsx` / `PermissionRationaleCard`
  for "Android"/"battery" — only the two fixed above.

## Connect risk
none — no changes to live.tsx, MediaSession, hub, offer/ICE/TURN, or settings.tsx.

COMPLETE
