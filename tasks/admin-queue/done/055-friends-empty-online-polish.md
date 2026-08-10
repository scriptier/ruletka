# Task: Friends empty + online strip polish (no connect)

## Goal
Small UX polish on Friends: empty states and online strip readability — match web softness, no protocol changes.

## Context
- `mobile/app/friends.tsx` + any friends styles in that file
- Prior work: home online strip, friend Call/Chat CTAs
- Users still see sparse empty lists / weak hierarchy when offline

## Scope (only these)
- `mobile/app/friends.tsx`
- i18n overlay en.json + ru.json only if new short keys needed
- Optional: tiny shared style in same file (no new design system)

## Done criteria
- [ ] Empty friends list: clear CTA (add by code / invite) — not a blank void
- [ ] Online strip / row: online vs offline visually distinct without clutter
- [ ] No hub protocol / MediaSession / live.tsx changes
- [ ] `cd mobile && npx tsc --noEmit` if practical
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done.

## Do not
- Deploy / push / APK
- Change call/ring/push registration logic (layout/copy only)
- Touch CONNECTIVITY_LOCK paths
