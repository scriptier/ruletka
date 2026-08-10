# Task: Home online-friends strip polish

## Goal
Home screen shows a clear strip when friends are online (count + tap → Friends or Call), without clutter when zero online.

## Context
- Hub already tracks friends online; home has pool + last match chrome.
- Play retention: “someone is online” should be one glance.

## Scope (only these)
- `mobile/app/index.tsx`
- Optional small styles / i18n `mobile.home.*` in en.json + ru.json

## Done criteria
- [ ] When `onlineFriends >= 1`, visible strip or chip with count
- [ ] Tap navigates to Friends (or primary online friend call if already safe pattern exists)
- [ ] Zero online: no empty ugly chrome
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done criteria met.

## Do not
- Touch live match / MediaSession
- Deploy / push / build APK
