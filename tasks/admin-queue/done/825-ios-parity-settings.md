# Task: iOS Settings screen parity

## Spec
`knowledge/specs/current-ios-parity.md`

## OWN
- `mobile/app/settings.tsx`

## Goal
Settings rows that are Android-only (battery opt-in, etc.) should hide or have iOS copy. Visual: same dark theme, blocked thumbs, export/import. Match Android **0.1.477** feel, not an older pin.

## Must not
friends.tsx, live.tsx, MediaSession, deploy, EAS/TestFlight, `push.sh`

## Done
- [ ] Platform.OS ios branches for Android-only rows
- [ ] RESULT at `tasks/admin-queue/done/825-ios-parity-settings-RESULT.md` contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when Done boxes are true. Do not invent TestFlight PASS.
