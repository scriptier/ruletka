# Task: Settings hint consistency (mobile overlay)

## Goal
Audit `mobile/src/i18n/overlay/en.json` vs `ru.json` for settings.* hints that still contradict product defaults (blur off, connect-first). Fix only contradictory blur/connect-related strings.

## Scope
- `mobile/src/i18n/overlay/en.json`
- `mobile/src/i18n/overlay/ru.json`

## Done criteria
- [ ] No string claims blur-on-by-default or permanent black veil as default
- [ ] RESULT + COMPLETE

## Do not
- Deploy / media / live.tsx
