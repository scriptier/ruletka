# Task: Home offline / reconnect soft copy

## Goal
If home shows hub offline or reconnect states, ensure short soft EN+RU strings exist and are used (no hard Alert for soft offline if toast exists).

## Scope
- `mobile/app/index.tsx` (copy/toast only)
- `mobile/src/i18n/overlay/en.json` + `ru.json` only if new keys needed

## Done criteria
- [ ] Offline/reconnect messaging is soft and clear
- [ ] No hub protocol changes
- [ ] RESULT + COMPLETE

## Do not
- Connect/WebRTC / deploy
