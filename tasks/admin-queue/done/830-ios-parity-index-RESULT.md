# 830 — iOS Home (index) vs Android — RESULT

## Status
COMPLETE

## What changed
`mobile/app/index.tsx` root card list is unchanged (same cards/order as Android — no card
content, order, or logic was touched). Added iOS safe-area handling so the home screen
respects the notch/status bar and home-indicator on iOS, matching the pattern already used
in `app/rules.tsx` (top) and `app/friends.tsx` (bottom):

- Imported `useSafeAreaInsets` from `react-native-safe-area-context` (already a project
  dependency, used app-wide via the `SafeAreaProvider` mounted in `_layout.tsx`).
- `HomeBody` now reads `const insets = useSafeAreaInsets();`.
- Root `<View>` gets inline `paddingTop: Math.max(insets.top, 24)` and
  `paddingBottom: Math.max(insets.bottom, 24)` on top of the base style.
- `styles.root` changed from `padding: 24` to `paddingHorizontal: 24` (vertical padding is
  now driven by the safe-area-aware inline style; horizontal stays fixed at 24 as before).

This fixes content potentially sitting under the iOS notch/status bar or the home-indicator
after returning to Home via Back from `/live` — no visual/behavioral change on Android since
`insets.top`/`insets.bottom` are 0 there and `Math.max(_, 24)` falls back to the prior
constant padding.

## Files touched
- `mobile/app/index.tsx`

## Verify commands run
- `npx tsc --noEmit` (from `mobile/`) — no new errors introduced by this change. Pre-existing
  errors in the worktree are all `Cannot find module 'expo-clipboard'` /
  `react-native-gesture-handler'` / etc. (missing node_modules in this worktree, present
  identically in `friends.tsx`, `settings.tsx`, `live.tsx`) plus unrelated pre-existing
  `live.tsx` errors. `react-native-safe-area-context` resolves cleanly (already used
  elsewhere) and `app/index.tsx` shows only the pre-existing `expo-clipboard` module error,
  same as every other screen file.
- `git diff -- mobile/app/index.tsx` reviewed line-by-line to confirm only the safe-area
  import/hook/padding lines were added by me; the rest of the pre-existing diff in this
  worktree predates this task.

## Connect risk
none — no changes to hub/ICE/offer/MediaSession/live.tsx/_layout.tsx. `BootToLiveOnce`
(in `_layout.tsx`) was not touched.

COMPLETE
