# 448 — Settings privacy chip a11y labels — RESULT

## Status
COMPLETE

## Summary
The shared `Chip` component (`mobile/app/settings.tsx`) already set
`accessibilityRole="button"`, `accessibilityLabel`, and
`accessibilityState={{ selected }}` for every chip, including the "Hide my
IP" and "Stranger privacy veil" (blur mode) chips — so a bare label/role was
already present.

Gap: the accessibilityLabel for those two privacy chip groups was just the
visible option text (e.g. "Off (P2P OK)", "Until I tap (default)") with no
field context, so a screen-reader user landing on a chip via swipe
navigation (without having just read the preceding `fieldLabel` Text) would
hear only "Off, button, selected" with no indication of which privacy
setting it controls.

## Change
- Added an optional `a11yLabel` override prop to `Chip` (defaults to
  `props.label`, so every other chip in the screen is unaffected).
- Hide-my-IP chips: `a11yLabel` = `"Hide my IP: <option>"`.
- Stranger privacy veil (blur mode) chips (off/intro/hold): `a11yLabel` =
  `"Stranger privacy veil: <option>"`.

## Files touched
- `mobile/app/settings.tsx`

## Verify commands run
- `npx tsc --noEmit` (mobile/) — no new errors introduced by this change.
  Pre-existing errors in the tree are all missing-module errors for
  packages not installed in this worktree (`expo-clipboard`,
  `expo-keep-awake`, `react-native-gesture-handler`, etc.) and are unrelated
  to `settings.tsx`'s edited lines.

## Connect risk
none — no MediaSession, SoftBlur native, ICE/TURN, or offer/answer code
touched. Pure a11y label text on existing Settings UI chips.

COMPLETE
