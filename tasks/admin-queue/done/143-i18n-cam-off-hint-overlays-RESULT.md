# 143 — camOffHint multi-lang overlays — RESULT

## Status
COMPLETE

## Audit
- `mobile.live.camOffHint` (rendered under the controls row + accessibility hint when cam is off, `mobile/src/live/LiveBottomBar.tsx:389-401`, `mobile/app/live.tsx`) is present in all 14 `mobile/src/i18n/overlay/*.json` locales — no missing key.
- Per prior tasks (020/021b), this key was originally set to mirror web's exact parity string `btn.selfBlurBadge` ("Hidden from them" and its 13 translations, see `ui/i18n/*.json`), so the Android promise reads identically to web's self-blur badge.
- Found drift: in the current worktree, `en.json` and `ru.json` had their `mobile.live.camOffHint` values overwritten with an unrelated phrase — `"Camera paused — they can't see you"` (en) / `"Камера на паузе — они вас не видят"` (ru) — while the other 12 locales (ar, bg, cs, de, es, fr, pl, pt, sr, tr, uk, zh) still carried the original "Hidden from them" translations. This text appears to have leaked in from the separate `mobile.live.camOffToast` key (a toast string used in `live.tsx:2845`, unrelated UI surface), breaking cross-locale and cross-platform (web ↔ Android) consistency for just these 2 of 14 languages.

## Fix
- `mobile/src/i18n/overlay/en.json`: `mobile.live.camOffHint` → `"Hidden from them"` (restored, matches web `btn.selfBlurBadge` and the other 12 overlays).
- `mobile/src/i18n/overlay/ru.json`: `mobile.live.camOffHint` → `"Скрыты от них"` (restored, matches web `btn.selfBlurBadge` ru and the other 12 overlays).
- No new keys added; no code files touched (`t()` usage in `live.tsx` / `LiveBottomBar.tsx` unchanged, only the existing key's values corrected).

## Files touched
- `mobile/src/i18n/overlay/en.json` (1 value)
- `mobile/src/i18n/overlay/ru.json` (1 value)

## Verify commands run
- `python3 -c "json.load(...)"` on all 14 `mobile/src/i18n/overlay/*.json` files — all parse as valid JSON, no duplicate keys (checked via regex key scan), `mobile.live.camOffHint` present and now consistent across all 14 locales.

## Out of scope (found during audit, not fixed — separate ticket recommended)
- `mobile.live.camOffToast` (the toast shown in `live.tsx:2845` on cam-off) is a **different** key from `camOffHint` and has its own, worse problem: 9 locales (ar, bg, cs, de, es, fr, pl, pt, uk) contain literal untranslated English text `"Camera paused — they can't see you"`, and 3 locales (sr, tr, zh) are missing the key entirely. `en`/`ru` have their own distinct, correctly localized copy for this key. This is a real user-facing gap but is a separate key/string from the one named in this task's title, and fixing it properly needs real translations for up to 9-12 languages — out of scope for this "minimal fix, existing t() keys" ticket.

## Connect risk
none — i18n JSON overlay copy only, no `t()` call sites, `MediaSession`, offer/ICE/TURN, or connect-path code touched.

COMPLETE
