# Task: ReportSheet string audit EN/RU

## Goal
Scan `mobile/src/safety/ReportSheet.tsx` for hardcoded English; if any user-visible strings lack `t()`, add overlay keys en+ru and wire them.

## Scope
- `mobile/src/safety/ReportSheet.tsx`
- `mobile/src/i18n/overlay/en.json` + `ru.json` only if needed

## Done criteria
- [ ] No new hardcoded EN user strings (or documented why)
- [ ] RESULT + COMPLETE

## Do not
- Report protocol / hub / deploy
