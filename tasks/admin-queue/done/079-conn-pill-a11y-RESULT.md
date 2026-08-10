# 079 — LiveConnPill a11y audit — RESULT

## Status
COMPLETE

## Audit summary
Reviewed `mobile/src/live/LiveConnPill.tsx` retry buttons and status summary.

**Already correct (no change needed):**
- Both retry `Pressable`s have `accessibilityRole="button"`, correct idle/busy `accessibilityLabel`
  (soft: `retryPathLabel`/`retryingLabel`; hard: `rebuildPathLabel`/`retryHardLabel`), and
  `accessibilityState={{ disabled, busy }}` synced with the `disabled` prop.
- Decorative status `Text` nodes (`connTimer`, `connPillText`, `connQuality`) correctly carry
  `importantForAccessibility="no"` so their content isn't double-announced.

**Gap found and fixed:**
- The status summary (`accessibilityRole="summary"`, `accessibilityLiveRegion="polite"`,
  `accessibilityLabel={statusA11y}`) was set on the *outer* pill `View`, which also contains the
  two retry buttons as siblings — but that `View` never had `accessible={true}`. On Android this
  mostly worked by heuristic (a `View` with a set `accessibilityLabel` becomes an auto-important
  node), but on iOS a `View` without explicit `accessible={true}` is not exposed to VoiceOver as
  an element at all, so the merged status label would never be read, while the individual
  `importantForAccessibility="no"` (Android-only, no-op on iOS) child `Text`s would each be read
  separately — producing silence or fragmented/duplicated announcements depending on platform.

**Fix:** wrapped just the three status `Text`s in a new inner `View` with `accessible`,
`accessibilityRole="summary"`, `accessibilityLiveRegion="polite"`, `accessibilityLabel={statusA11y}`
(moved off the outer pill container, which keeps only its visual/tint styling). The retry buttons
remain plain siblings of that wrapper inside the outer `View`, so they stay independently
focusable/labeled on both platforms — an ancestor `accessible={true}` would otherwise have
collapsed the whole subtree (including the buttons) into one leaf on iOS. Inline
`flexDirection: row, alignItems: center, gap: 8` on the new wrapper preserves the prior visual
layout exactly (same values as `styles.connPill`'s row gap).

## Files touched
- `mobile/src/live/LiveConnPill.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — 0 errors in `LiveConnPill.tsx` (pre-existing unrelated
  errors elsewhere in the repo, e.g. missing `expo-clipboard`/`expo-keep-awake` type decls, are
  unchanged by this diff).

## Connect risk
none — no changes to `conn`/ICE/TURN/retry logic, only JSX structure + accessibility props around
existing status text/buttons. Visual layout preserved.

COMPLETE
