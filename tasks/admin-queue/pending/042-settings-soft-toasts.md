# Task: Settings soft errors → toast

## Goal
Convert non-destructive Settings `Alert.alert` failures (offline, import fail copy, hub reconnect noise) into soft toasts — same pattern as Live + Friends. **Keep** Alerts for destructive or multi-step confirms (export password, clear data, unblock, import overwrite).

## Context
- Live soft toasts shipped 0.1.148 (`mobile/app/live.tsx`).
- Settings still has several hard popups for soft errors.

## Scope (only these)
- `mobile/app/settings.tsx`
- i18n only if a new short string is required (`mobile/src/i18n/overlay/en.json` + `ru.json`)

## Done criteria
- [ ] Soft failures use toast / `showToast`
- [ ] Destructive / multi-choice still Alert
- [ ] No connect/WebRTC edits
- [ ] `cd mobile && npx tsc --noEmit` if practical
- [ ] RESULT + **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done criteria met.

## Do not
- Deploy / push / merge main
- Change notify push registration behavior (copy only if needed)
- Build APK (Grok owns)
