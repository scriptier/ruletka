# 058 — Settings hint consistency (mobile overlay)

## Status
COMPLETE — no changes needed.

## Audit
Checked every `mobile.settings.*` key touching blur/veil/hideIp/connect in both
`mobile/src/i18n/overlay/en.json` and `mobile/src/i18n/overlay/ru.json`, plus the
`mobile.live.blur*` strings they cross-reference (modal copy only shown while a
veil is actually active, so not a "default" claim).

Findings — already consistent, no contradictions:
- `mobile.settings.blurStrangersHint` (en L477 / ru L430): "Off = fastest connect
  (default)... Friends never auto-veil." — correctly states off/fastest-connect
  is the default in both languages.
- `mobile.settings.blurModeOff` (en L480 / ru L433): "Off (default)" / "Выкл (по
  ум.)" — consistent.
- `settings.hideIpHint` (en L611 / ru L563): "Off by default (faster P2P)..." /
  "По умолчанию выкл (быстрее P2P)..." — consistent.
- No string in either file claims blur-on-by-default or a permanent black veil
  as default. `mobile.live.blurBody`/`blurBodyHold` only render inside the
  live-call blur modal when a veil is already active (per-match opt-in/mode
  setting), not a default-state claim, so they don't contradict the
  off-by-default settings copy.

## Files touched
None (audit only, no edits required).

## Verify commands run
- `grep -in "blur|veil|hidden|скрыт|шторк" mobile/src/i18n/overlay/en.json`
- `grep -in "blur|veil|hidden|скрыт|шторк" mobile/src/i18n/overlay/ru.json`
- `grep -in "black|default|умолчан" mobile/src/i18n/overlay/{en,ru}.json`

## Connect risk
none — no code or connectivity-path changes.

COMPLETE
