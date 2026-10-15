# P1-settings-play — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/app/settings.tsx` only

## Goal
Play-ready Settings: rows open, prefs persist, no crash on open/close, hide_ip / blur / lang work.

## What changed

### Prefs persist (chips, no Save required)
- Added `patchPrefs(partial, opts)` — merges MatchPrefs, writes AsyncStorage via `saveMatchPrefs`, optional hub push + toast.
- **hide_ip** → `setHideIp` → `patchPrefs` + `pushHub: true` + status toast (unchanged UX).
- **blur** → `setBlurMode` → `patchPrefs` + mode toast (unchanged UX).
- **gender / looking** → auto-save + hub `setPrefs` push so match filters stick without Save.
- **dataSaver / liveLayout / historySnaps / notifyFriendCalls** → auto-save on chip tap.
- **lang** → still `useI18n().setPref` (AsyncStorage `ruletka-mobile-lang-v1`); press handlers swallow rejections so a storage blip cannot crash the screen.
- **Save** still handles display name + full re-push + hello; wrapped in try/catch (no unhandled reject).

### No crash open/close
- Focus reload of prefs/sounds/name; never blanks form on load error.
- `useFocusEffect` cleanup closes `OpenOnPcSheet` on leave (avoids stuck Modal on re-entry).
- All 8 sections still toggle via `openSec` / `toggleSec` (profile, match, alerts, hub, mod, backup, safety, about).

### Unchanged (intentional)
- Destructive confirms stay as `Alert` (unblock, import overwrite, unhealthy hub, weak export pw).
- No APK / no version bump / no files outside OWN.

## Checklist (Play-ready)

| # | Check | Result |
|---|--------|--------|
| 1 | Open Settings from Home | OK — Redirect only if `!rulesOk` |
| 2 | Close / leave Settings | OK — PC sheet forced closed on blur |
| 3 | Re-open Settings | OK — prefs reloaded from storage |
| 4 | Section rows expand/collapse (all 8) | OK — chevron ▾/▸, no remount crash |
| 5 | hide_ip Off/On persists after leave+reopen | OK — immediate `saveMatchPrefs` + hub push |
| 6 | blur Off/Intro/Hold persists | OK — immediate save + soft toast |
| 7 | Language chip / System persists | OK — `setPref` AsyncStorage |
| 8 | Gender / Looking stick without Save | OK — `patchPrefs` + hub |
| 9 | dataSaver / liveLayout / historySnaps / notify | OK — auto-persist |
| 10 | Save (display name) no throw | OK — try/catch + toast |
| 11 | Export/import/unblock paths | Soft toasts; confirms retained |
| 12 | No APK built | Confirmed |

## Files
- `mobile/app/settings.tsx`

## Verify
- Static review of settings.tsx paths above.
- `npx tsc --noEmit` — no errors in `settings.tsx` (pre-existing errors only in `live.tsx`, untouched).

## Connect risk
**none** — Settings UI / AsyncStorage prefs only; no MediaSession / ICE / live stage.

## Handoff smoke (device, human)
1. Settings → Match → toggle hide IP → leave → reopen → chip still selected.
2. Blur Intro → Hold → Off → reopen → last choice sticks; Live uses mode on next stranger match.
3. Switch language RU ↔ EN → UI strings flip; survives app background.
4. Collapse every section, expand each once; Open on PC sheet open then back — no freeze.
5. Change Looking without tapping Save → Start match → hub should see new looking (connected).
