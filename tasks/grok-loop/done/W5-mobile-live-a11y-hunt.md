# W5 mobile hunt tile a11y

## Goal
lookingForThird / hunting panes have accessibilityLabel where missing.

## OWN
- mobile/app/live.tsx only (a11y labels for multi/hunt surfaces)

## Work
1. Grep multi/hunt Pressables/Views needing labels.
2. Minimal a11yLabel using existing i18n keys if any.
3. No APK. RESULT + COMPLETE.

## Must not
MediaSession thrash, friends/settings, deploy
