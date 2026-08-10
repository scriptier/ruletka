# 114 — Rules perm-step screen a11y

## Status
COMPLETE

## Summary
Audited `mobile/src/permissions/PermissionRationale.tsx` (the perm-step card rendered
by `rules.tsx`): both its `Pressable`s (Continue / Not now) already carry
`accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState`, so no
unlabeled pressables exist there. The gap was in the host, `mobile/app/rules.tsx`: the
perm step had no live region, so screen readers wouldn't announce the busy/loading
state change when the user taps Continue (label text and `ActivityIndicator` swap
silently). Wrapped the `PermissionRationaleCard` in the perm-step branch with a
`View accessibilityLiveRegion="polite"`, matching the existing convention used
elsewhere in the app (`settings.tsx`, `LiveConnPill.tsx`, `LiveStatusBanners.tsx`, etc.)
for status regions.

Also re-checked the age-step pressables (Yes/No/safety links) in the same file — all
already have `accessibilityRole` + `accessibilityLabel`, no changes needed there.

## Files touched
- `mobile/app/rules.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (mobile) — no errors for `rules.tsx`

## Connect risk
none — UI-only accessibility wrapper in the rules/onboarding screen, no changes to
media/offer/ICE/connect logic.

COMPLETE
