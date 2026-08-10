# 078 — LiveSearchLabel a11y / i18n audit — RESULT

## Status
COMPLETE

## Findings
- `LiveSearchLabel.tsx` itself was already correct: no hardcoded strings, all
  text comes from props populated by `t()` in `live.tsx`. The wrapping `View`
  has `accessibilityRole="text"`, `accessibilityLiveRegion="polite"`, and a
  combined `accessibilityLabel` (title + meta), and the child `Text` nodes are
  marked `importantForAccessibility="no"` so screen readers read the single
  combined label instead of double-announcing. No changes needed here.
- Traced the 7 props back to `mobile.live.*` i18n keys used in `live.tsx`
  (`looking`, `queueJoining`, `waitLine`, `firstInLine`, `queueInPool`,
  `queueConfirming`, `reconnecting`). Found `ru.json` was missing 3 of them
  (`queueJoining`, `queueInPool`, `queueConfirming`) — RU users would have
  silently fallen back to the English strings via `translate()`'s EN fallback
  in `mobile/src/i18n/index.tsx`. Added the missing RU strings.
- All 12 other overlay languages (ar, bg, cs, de, es, fr, pl, pt, sr, tr, uk,
  zh) are also missing the same 3 keys (plus `waitLine`, pre-existing gap).
  Left as-is — out of scope per task (en/ru only). Flagging for a follow-up
  i18n-overlay task if broader coverage is wanted.

## Files touched
- `mobile/src/i18n/overlay/ru.json` — added `mobile.live.queueConfirming`,
  `mobile.live.queueInPool`, `mobile.live.queueJoining`.

## Verify commands run
- `python3 -c "json.load(open('ru.json'))"` — valid JSON, 638 keys.
- `node mobile/scripts/test-live-units.mjs` — `live-units OK (6)`, all passing.

## Connect risk
none — no changes to `LiveSearchLabel.tsx`, `live.tsx`, or any connect/offer/
ICE/TURN path. Only added missing RU translation strings.

COMPLETE
