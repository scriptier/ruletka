# RESULT: 826-ios-parity-more-banners

## Status
COMPLETE (best-effort, static-analysis only — no physical iPhone/simulator
available to this agent; needs Grok/human TestFlight smoke to confirm pixel
fit).

## Context / note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(`knowledge/specs/` only has `2026-08-20-ru-reach.md`); read it from the main
tree (`/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`).
Same DONE WHEN / MUST NOT as prior 82x tasks in this chain: `Platform.OS`
branches where Android has chrome, no MediaSession/ICE/pool>0.

## What I found
Both owned components already had solid Android chrome (elevation-based
layering) but neither read `useSafeAreaInsets()`, unlike sibling live
components (`PartnerIdentityDock.tsx`, `LiveBottomBar.tsx`) which already
follow a "component pads itself on iOS" pattern for notch/home-indicator
clearance. Concretely:
- `LiveMoreSheet.tsx`: the floating card's stage padding (28pt) and the
  `ScrollView`'s bottom content padding were fixed constants — on an iPhone
  with a home indicator, a tall card (up to 78% height) or the last row
  (Report, a danger-styled tap target) could sit closer to the bottom
  gesture bar than intended, and a very tall card could crowd the notch.
- `LiveStatusBanners.tsx`: the blur banner's `wrap`/`wrapTop`/`wrapBottom`
  styles had no safe-area gap at all. `top` placement is currently always
  called from `live.tsx` with `showBlurBanner={false}` (a no-op there today
  per `verify-match-ux.mjs`'s guard against a duplicate Privacy-veil row),
  and `bottom` placement isn't wired up yet — but the component is exported
  and meant to be reused (e.g. for banned/connecting-style banners), so it
  should not assume a parent already handles the safe area.

## What changed
**`mobile/src/live/LiveMoreSheet.tsx`**
- Added `useSafeAreaInsets()`. On iOS, `moreWindowStage`'s vertical padding
  is now `28 + insets.top` / `28 + insets.bottom` (was a flat 28), keeping
  the centered card clear of the notch/Dynamic Island and the home
  indicator on taller cards.
- `ScrollView` now gets an iOS-only `contentContainerStyle` bottom padding
  of `max(insets.bottom, 12)` so the last row (Report) isn't flush against
  the card's rounded bottom edge / gesture-bar area when scrolled to end.
- Android output is byte-identical (all new padding is `Platform.OS ===
  "ios"`-gated).

**`mobile/src/live/LiveStatusBanners.tsx`**
- Added `useSafeAreaInsets()`. On iOS, `top` placement gets
  `marginTop: max(insets.top - 6, 0)` and `bottom` placement gets
  `marginBottom: insets.bottom`, so the banner carries its own safe-area
  clearance instead of assuming the caller already padded it (matches the
  `PartnerIdentityDock`/`LiveBottomBar` pattern). `default` placement is
  untouched. Android output is byte-identical (gated on `Platform.OS ===
  "ios"`).

No other lines touched. `live.tsx`, `MediaSession`, and any deploy/EAS/
TestFlight paths were **not** touched, per Must-not.

## Files touched
- `mobile/src/live/LiveMoreSheet.tsx`
- `mobile/src/live/LiveStatusBanners.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — zero errors referencing either
  touched file or `useSafeAreaInsets`. Remaining output is pre-existing,
  unrelated to this change: missing native module type declarations in
  this worktree's `node_modules` (`expo-clipboard`, `expo-image-manipulator`,
  `expo-av`, `react-native-gesture-handler`, `react-native-reanimated`) and
  pre-existing `live.tsx` / `matchContinuity.ts` / `MediaSession.ts` /
  `SoftBlurRemote.tsx` errors unrelated to this diff.
- `grep -n "react-native-safe-area-context" mobile/package.json` — confirms
  the dependency (`4.12.0`) already used by sibling components is available.
- No iOS simulator/device in this environment — verified via types + code
  review only, not an on-device TestFlight smoke.

## Connect risk
none — no hub/ICE/MediaSession/live.tsx changes; `connectivity-lock` script
not run (out of scope, no offer/ICE/media-session touched). Both changes are
presentation-only safe-area padding in floating/overlay chrome; Android
behavior is unchanged by construction (all new styles are `Platform.OS ===
"ios"`-gated, leaving prior Android style objects untouched).

COMPLETE
