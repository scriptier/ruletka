# 544 — Updates page refresh 2026-08-20

## Status
COMPLETE

## What changed
The Aug 20 featured block and i18n keys (`page.updates.updated`, `page.updates.uAug20*`) were already present in `ui/updates.html`, `ui/i18n/en.json`, and `ui/i18n/ru.json` with copy matching the spec (gifts move, tap ★ comet, timer/friend-code chrome move, Android 0.1.456, linking honestly framed as still in progress — no "fixed connect" / MULTI_PASS claim). All other `ui/i18n/*.json` locales already had the same keys copied verbatim from EN.

Only gap found: the hardcoded fallback text in `ui/updates.html` (line 62, the `<p class="updated">` before `data-i18n` swaps it at runtime) was missing "timer" compared to the JSON copy. Fixed so the no-JS fallback matches the live-updated text:
- Before: `Last updated: 2026-08-20 · gifts that move, tap ★, Android 0.1.456`
- After: `Last updated: 2026-08-20 · gifts that move, tap ★, timer, Android 0.1.456`

## Files touched
- `ui/updates.html` (1 line: fallback "updated" text)

No other files were modified — `en.json`/`ru.json` keys and the other 12 locale files already matched spec, so no edits were needed there.

## Verify commands run
- `python3 -c "import json; json.load(open(f))"` over all `ui/i18n/*.json` — all valid.
- `grep` for `fixed connect|MULTI_PASS|GOAL_MET|product.ok` in `ui/updates.html`, `en.json`, `ru.json` — only the intentional "No 'fixed connect' claim" honesty line appears; no invented pass/goal claims.
- Manual diff review of the Aug 20 block copy against the task spec's required wording — matches (gifts, tap ★/3★→1★, friend call 1v1, live chrome timer/friend-code, Android 0.1.456, linking not-fixed disclaimer).

## Connect risk
none — no changes to `live.js`, `live-stage.css`, MediaSession, hub, ICE/TURN, or any connectivity code. Text/i18n only.

COMPLETE
