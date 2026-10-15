# L15 Settings blur Hold note — RESULT

## Status
**COMPLETE**

## OWN
- `knowledge/specs/SMOKE-NEXT.md` + `BLUR-MULTI-FINISH-PLAN.md` (read-only)
- i18n: `mobile/src/i18n/overlay/en.json` (+ RU for device locale)
- Settings UI: `mobile/app/settings.tsx` (`setBlurMode` / chips under Match section)
- **No invent multi / blur product PASS** — doc only

## Why this note
L13 phone blur Hold smoke (`L13-phone-blur-hold-smoke-RESULT.md`) hit **MATCHED** + veil/`[blur] show`, but **`prefs_load mode=intro`** — Hold path **not** exercised. Next L13-style smoke needs a human (or UI tap) to set **Hold** first.

SMOKE-NEXT §E2.5 / BLUR plan residual: blur **Off / Intro / Hold** persist → next stranger match uses last mode; Hold = veiled until **Show video**.

---

## Human: set stranger blur → **Hold** (Android Settings)

**APK tip:** `0.1.367-vc375` · package `me.ruletka.app`  
**Open Settings:** Home → **Settings** (`mobile.nav.settings`) · or deeplink `ruletka://settings` · home chip **Match prefs & name** (`mobile.home.settings`).

| Step | EN label (i18n key) | RU label (if device is RU) |
|------|---------------------|----------------------------|
| 1. Expand section | **Match & language** (`mobile.settings.secMatch`) | **Матч и язык** |
| 2. Find row | **Stranger privacy veil** (`mobile.settings.blurStrangers`) | **Шторка для незнакомцев** |
| 3. Tap chip | **Until I tap** (`mobile.settings.blurModeHold`) | **Пока не нажму** |
| — other chips | **Off (default)** / **Brief (~2.5s)** (`blurModeOff` / `blurModeIntro`) | **Выкл (по ум.)** / **Кратко (~2,5 с)** |
| 4. Confirm toast | **Privacy veil · Until I tap · next stranger match** (`mobile.settings.blurModeSaved` with `{mode}`) | **Шторка · Пока не нажму · следующий матч с незнакомцем** |

**Persist:** chip auto-saves (`setBlurMode` → `saveMatchPrefs`) — **no Save button** required. Leave Settings; optional kill/reopen app.

**Hint under chips** (`mobile.settings.blurStrangersHint`): *Off = fastest connect … Brief = soft veil ~2.5s then open. **Hold = veiled until Show video.** Mid-chat: eye on the call bar. Friends never auto-veil.*

### Mid-match smoke expect (Hold only)
- Logcat: `[blur] prefs_load mode=hold` (not `intro` / `off`)
- Veil stays until **Show video** (`mobile.live.unblur` / `unblurReady` — EN **Show video** / **Show video — ready**; RU **Показать видео** / **Показать — готово**)
- Eye on call bar still toggles veil (`blurBodyHold`)
- Friends calls: never auto-veil

### Next L13-style smoke (after Hold set)
1. Human sets **Until I tap** as above → toast confirms  
2. `SKIP_INSTALL=1 WEB_PAIR=1` (or human Start) stranger match on tip APK  
3. Assert: `prefs_load mode=hold` + veil **stays** mid-match (no `hide why=intro_auto`) until Show video  
4. Still **no invent multi PASS** — 1v1 Hold path only unless multi boxes human-pasted  

---

## Explicit non-claims
- **Not** product PASS / GOAL_MET for blur Hold  
- **Not** multi 3-way / 4-way  
- **Not** APK rebuild / Settings code edit this hop  

## Connect risk
**None** — documentation only.
