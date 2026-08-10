# 101 — Rules screen a11y

## Status
COMPLETE

## What changed
Audited `mobile/app/rules.tsx` age-gate CTAs and links; none had `accessibilityRole`/`accessibilityLabel`.
(For comparison, `mobile/src/permissions/PermissionRationale.tsx` — the "Continue"/"Not now"
permission-rationale step rendered by this same screen — already had them; used as the pattern to match.)

Added to the four interactive `Pressable`s in the age-gate step:
- Accept CTA (`rules.ageYes`): `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{ disabled, busy }}`
- Decline (`mobile.rules.under18`): `accessibilityRole="button"`, `accessibilityLabel`, `accessibilityState={{ disabled }}`
- Safety tools link (`mobile.safety.openPage`): `accessibilityRole="link"`, `accessibilityLabel`
- Child safety standards link (`mobile.safety.childStandards`): `accessibilityRole="link"`, `accessibilityLabel`

Also marked each button's inner `Text` with `importantForAccessibility="no"` so screen readers announce
the Pressable's `accessibilityLabel` once instead of double-reading the nested text (matches existing
pattern in `PermissionRationale.tsx`).

## Files touched
- `mobile/app/rules.tsx`

## Verify commands run
- `cd mobile && npx tsc --noEmit -p .` — pre-existing unrelated errors only (missing native
  module type declarations, `live.tsx` issues); no errors in `app/rules.tsx`.

## Connect risk
none — no changes to media/WebRTC/offer/ICE/TURN logic; purely accessibility props on existing buttons.

COMPLETE
