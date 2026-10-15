# RESULT: 831-ios-parity-gift-bar

## Status
COMPLETE (static-analysis + unit-test verified — no physical iPhone/simulator
available to this agent; needs Grok/human TestFlight smoke to confirm visually).

## Context / note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(`knowledge/specs/` here only has `2026-08-20-ru-reach.md`); read it from the
main tree (`/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`),
consistent with the note left by the prior 827 hop. Same DONE WHEN / MUST NOT
as the 82x/83x chain: add `Platform.OS` branches where Android has chrome; no
MediaSession/ICE/pool>0.

## What I found
`LiveGiftBar` is only ever mounted from `LiveMoreSheet.tsx` (a floating card,
not a fixed bottom dock), and that sheet already applies its own
`useSafeAreaInsets()` bottom padding to the outer stage + scroll container.
So the acute "under the home indicator" risk today is contained upstream —
but `LiveGiftBar` itself had zero iOS safe-area awareness, i.e. it silently
depends on whichever caller mounts it to do the right thing (fragile; the
`verify-match-ux.mjs` history shows this component used to live directly on
`live.tsx`'s bottom bar before the 410 hop moved gifts into the sheet, so a
future caller mounting it as a bottom dock again would regress silently).

Separately, the tap-target requirement: `giftChipCompact` (`liveStyles.ts`,
used whenever `LiveGiftBar` renders `compact`) produces a real content box of
~42pt tall (`paddingVertical: 4` + ~22pt emoji line + ~12pt cost line) — under
Apple's 44×44pt minimum. `TapPressable`'s default `hitSlop` (8pt top/bottom,
6pt left/right) numerically covers the gap, but the chips sit in a tightly
packed horizontal row (`gap: 6` in `giftsRowCompact`), so relying on hitSlop
alone means adjacent chips' invisible hit regions overlap by design — an
unreliable way to satisfy "tap targets ≥44pt" versus giving the actual
pressable box that floor.

## What changed
**`mobile/src/live/LiveGiftBar.tsx`** only (kept `mobile/src/stars/gifts.ts`
untouched — no data/config change was needed there; it stayed in OWN as a
read-only dependency).

- Imported `Platform` (react-native) and `useSafeAreaInsets`
  (react-native-safe-area-context, already a dependency used by
  `live.tsx`/`LiveMoreSheet.tsx`).
- Added a self-contained `iosHomeIndicatorPad` (`Platform.OS === "ios" ?
  { paddingBottom: Math.max(insets.bottom, 8) } : null`), applied to the
  outer `giftSection` View alongside the existing `compact` style. Android is
  a byte-identical no-op (branch is `null`). This makes the component safe
  regardless of what mounts it, instead of solely trusting the current
  `LiveMoreSheet` caller.
- Added a local `giftChipTapMin` style (`minHeight: 44, justifyContent:
  "center"`) applied only when `compact` (full-size chips already measure
  well over 44pt from their label + cost lines, so no change there). This
  bumps the actual pressable box to the Apple HIG floor instead of relying on
  hitSlop overlap between adjacent chips.

No other lines touched. `live.tsx`, `GiftFxOverlay.tsx`, `LiveMoreSheet.tsx`,
`liveStyles.ts`, `MediaSession`, and any deploy/EAS/TestFlight paths were
**not** edited — both changes live entirely inside `LiveGiftBar.tsx`'s own
render, so the one caller (`LiveMoreSheet.tsx`) picks them up with no wiring
changes.

## Files touched
- `mobile/src/live/LiveGiftBar.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — no errors referencing `LiveGiftBar.tsx`
  or `src/stars/gifts.ts`.
- `node src/stars/giftFxHold.test.mjs` — `giftFxHold.test.mjs OK`.
- `node scripts/verify-match-ux.mjs` — `L0 done: 140 ok, 0 fail` (includes
  gift-chip / LiveMoreSheet / LiveGiftBar wiring assertions, e.g. "tap
  conversationalist ★ sends shooting_star", "please stay is a partner-actions
  row (not gift chip)").
- No iOS simulator/device in this environment — verified via types + existing
  unit/wiring tests only, not an on-device TestFlight smoke.

## Remaining gap / caveat
This is a defensive/structural parity fix, not a proven pixel fix: I could
not visually confirm on a real iPhone that the compact chip now reads as
44pt or that the bottom padding clears the home-indicator gesture bar in the
live `LiveMoreSheet` layout. Needs a human/Grok TestFlight smoke (open the
More sheet mid-call, scroll to the gift row, confirm no visual regression in
the sheet's existing padding math — my addition should be a no-op today since
`LiveMoreSheet` already pads its scroll content, and only becomes load-bearing
if `LiveGiftBar` is ever mounted outside that sheet again).

## Connect risk
none — no hub/ICE/MediaSession/live.tsx changes; connectivity-lock script not
run (out of scope, no offer/ICE/media-session touched). Change is a
presentation-only safe-area padding + minHeight style tweak on an existing
component.

COMPLETE
