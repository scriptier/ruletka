# Task: Sync blur/privacy i18n overlays (non-EN/RU)

## Goal
Bring **blur stranger mode** + **blurModeSaved** + **home liveTips** strings in all mobile overlay packs in line with EN (default off, brief, hold). EN/RU already updated — fix the rest so RU-default isn’t the only accurate copy.

## Context
- Source of truth: `mobile/src/i18n/overlay/en.json` keys:
  - `mobile.settings.blurStrangers`
  - `mobile.settings.blurStrangersHint`
  - `mobile.settings.blurModeOff` / `blurModeIntro` / `blurModeHold`
  - `mobile.settings.blurModeSaved` (new: `"Privacy veil · {mode} · next stranger match"`)
  - `mobile.home.liveTips`
- Many packs (de/es/fr/pl/uk/…) still say “Brief frost… (default)” which is **wrong** — product default is **Off**.

## Scope (only these)
- `mobile/src/i18n/overlay/*.json` **except** leave en.json alone if already correct; update ru only if missing `blurModeSaved`
- Optional: one-line note in RESULT listing packs touched

## Done criteria
- [ ] Every overlay pack has the five blur keys + `blurModeSaved` + accurate liveTips
- [ ] No pack claims intro/hold is the default
- [ ] No `mobile/app/*` or media/connect edits
- [ ] RESULT under `tasks/admin-queue/done/` with **COMPLETE**

## Completion promise
Put `COMPLETE` in RESULT when done.

## Do not
- Deploy / push / APK / touch WebRTC / live.tsx
- Invent SFU or Prefer Direct strings
