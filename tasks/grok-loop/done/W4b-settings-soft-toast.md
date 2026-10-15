# W4b settings soft toast dead-row audit

## Goal
Every tappable Settings row either works or soft-toasts; no silent no-op.

## OWN
- `mobile/app/settings.tsx` only

## Work
1. Grep Pressable/onPress; soft toast on stub paths.
2. No APK. RESULT + COMPLETE

## Must not
- friends.tsx, MediaSession, deploy
