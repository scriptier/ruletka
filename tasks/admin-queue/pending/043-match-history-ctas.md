# Task: Match history labeled Call CTAs

## Goal
Match history rows on Friends screen get clearer primary actions (labeled Call / muted offline), matching Friends list density (Online pill style optional).

## Context
- Friends `FriendRow` now has Online pill + labeled Chat/Call (`mobile/app/friends.tsx`).
- History rows still use icon-only call button.

## Scope (only these)
- `mobile/app/friends.tsx` (history section only)
- Styles in same file
- i18n keys only if needed (`mobile.history.*`)

## Done criteria
- [ ] History Call is labeled (or clear primary CTA)
- [ ] Offline still can ring (muted style OK)
- [ ] No offer/WebRTC changes
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done criteria met.

## Do not
- Redesign entire Friends screen
- Deploy / push
