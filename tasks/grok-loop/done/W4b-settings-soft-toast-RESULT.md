# W4b settings soft toast dead-row audit — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/app/settings.tsx` only

## Goal
Every tappable Settings row either works or soft-toasts; no silent no-op.

## What changed (minimal)

Grep’d all `Pressable` / `onPress` paths. Working rows left alone. Fixed silent no-ops and swallowed-error stubs:

| Path | Before | After |
|------|--------|--------|
| Hub row already active | `if (active) return` silent | soft toast `{host} · active` |
| Open notification settings | `.catch(() => {})` | fail → soft toast (`mobile.common.offline` / EN fallback) |
| Battery unrestricted (Android) | toast only on `ok` | fail → soft toast |
| Clear report history | clear list, no feedback | soft toast clear label; fail toast |
| Share app | Share catch empty | fail → soft toast |
| Copy support email | clipboard fail → mailto catch empty | mailto fail → toast email string |
| Build / version box | long-press only; short tap silent | short **and** long press copy + toast (`buildCopied`); copy fail → hint toast |

### Already OK (no edit)
- Section expand/collapse, chips (lang / gender / looking / dataSaver / liveLayout / historySnaps / notify / uiSounds)
- hide_ip + blur immediate save + toast
- Save / export / import / push register / hub reconnect / hub switch / pin home / Open on PC / safety links (Alert on open fail)
- Destructive confirms stay `Alert` (unblock, import overwrite, unhealthy hub, weak export pw)

## Not done (by design)
- No APK / version bump
- No i18n key adds (OWN = settings.tsx; EN string fallbacks where needed)
- No friends.tsx / MediaSession / deploy / git push
- Chip local-state until Save (dataSaver etc.) is intentional, not a dead row

## Files
- `/home/drakosik/freenet-roulette/mobile/app/settings.tsx`

## Verify
- Static Pressable/onPress audit complete.
- `npx tsc --noEmit` — **no errors in `settings.tsx`** (pre-existing errors only in `friends.tsx` / `live.tsx`, untouched).

## Connect risk
**none** — Settings UI feedback only; no MediaSession / ICE / live stage.

## Handoff smoke (device, human, optional)
1. Hub section → tap the already-active hub row → toast “· active”, not silence.
2. About → tap build/version box once → copies build + toast (same as long-press).
3. Alerts → Open notification settings with airplane/odd OEM edge → fail toasts if OS open rejects.
4. Mod → Clear log → toast; list empty.
5. About → Share → cancel is OS; hard fail path soft-toasts.
