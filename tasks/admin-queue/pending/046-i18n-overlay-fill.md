# Task: i18n overlay fill (notify + friends + live soft strings)

## Goal
For mobile overlay langs that still fall back to English on key UX strings, copy/adapt from `en.json` for: notify hints, friends Online/Chat/Call related, live partnerNotReady / needStars.

## Context
- EN/RU/UK updated recently; es/de/fr/etc. may still have English notifyHint or gaps.

## Scope (only these)
- `mobile/src/i18n/overlay/*.json` (thin overlays)
- Do **not** rewrite full packs under `packs/`

## Done criteria
- [ ] No `ROULETTE_PUSH_WEBHOOK_URL` in user-facing overlay strings
- [ ] notifyHint / notifyOn / friends.chat keys present or intentional EN fallback documented
- [ ] JSON still valid
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done criteria met.

## Do not
- Machine-translate entire app
- Deploy
