# Settings privacy chip a11y labels

## Goal
Ensure SoftBlur/privacy mode chips in Settings have accessible labels / roles without product SoftBlur thrash. Polish only.

## OWN
- mobile/app/settings.tsx (a11y props / accessibilityLabel only)
- RESULT: tasks/admin-queue/done/448-settings-privacy-a11y-label-RESULT.md

## Done criteria
- [ ] Privacy chips have accessibilityLabel (or document already present)
- [ ] RESULT + COMPLETE
- [ ] No MediaSession / SoftBlur native / APK

## Must not
MediaSession rewrite, SoftBlur product flag thrash, ICE, deploy/APK
