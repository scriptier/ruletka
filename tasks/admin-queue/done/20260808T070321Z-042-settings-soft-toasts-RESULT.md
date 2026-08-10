# RESULT: 042-settings-soft-toasts

## Status
DONE

## Completion promise
COMPLETE

## What changed
Converted non-destructive `Alert.alert` popups in `mobile/app/settings.tsx` to soft toasts (`showToast`, same pattern as Live/Friends), leaving destructive/multi-step confirms as Alerts.

- `unblock()` failure (offline error after confirming unblock) → toast
- Export success (`exportDone` + `exportStarsNote`) → single combined toast
- Export failure (`exportFail`) → toast
- Import "needs password" (`importNeedPw`) → toast
- Import "wrong password" (`importWrongPw`) → toast
- Import success (`importDoneStarsHub` + `importDoneDevice`) → single combined toast
- Import failure, both catch sites (`importFail`) → toast

Kept as `Alert.alert` (unchanged, all are multi-choice confirms or need persistent/copyable text):
- Unblock confirm (Cancel / Unblock)
- Export password-too-weak validation gate (`exportPwWeak`) — explicitly named in task scope to keep
- Import-overwrite confirm (Cancel / Import, replaces device identity)
- Hub-unhealthy confirm (Cancel / Use anyway)
- Legal/safety link open-failure fallback (shows the raw URL so the user can read/copy it — a toast would make it illegible and disappear in 4s)

No i18n changes needed — all toast messages reuse existing translation keys (just concatenated title+body where the original Alert had two parts). No connect/WebRTC code touched.

## Files
- mobile/app/settings.tsx

## Verify ran
- `cd mobile && npx tsc --noEmit` — no errors in settings.tsx (pre-existing unrelated errors remain in live.tsx, untouched by this task)

## Connect risk
safe to merge after smoke

## Handoff for morning
- merge branch: admin/20260808T070321Z-042-settings-soft-toasts
- smoke: open Settings → trigger export (weak pw, success, failure), import (bad file, wrong pw, success/overwrite confirm), unblock a blocked user while offline, tap an unhealthy hub row — confirm toasts appear where expected and confirms still show Alert dialogs
- do not: deploy without Play↔PC check
