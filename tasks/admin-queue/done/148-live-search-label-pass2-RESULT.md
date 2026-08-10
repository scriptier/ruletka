# 148 — LiveSearchLabel pass2 — RESULT

## Status
COMPLETE

## Audit
- `LiveSearchLabel.tsx` component logic itself is unchanged from the 078
  audit — no hardcoded strings, correct a11y wiring (single combined
  `accessibilityLabel`, children marked `importantForAccessibility="no"`).
- Re-checked all 14 overlay locales for the 7 `t()` keys the component's
  props are sourced from (`mobile.live.looking`, `queueJoining`, `waitLine`,
  `firstInLine`, `queueInPool`, `queueConfirming`, `reconnecting`).
- The `ru.json` gap from pass1 (078) is resolved, and all 14 locales now
  *have* all 7 keys — but found a new issue: **`ar.json`, `bg.json`,
  `cs.json`, `sr.json` had 3 of the 7 keys present only as leftover English
  placeholder text** (`looking`, `firstInLine`, `reconnecting`), while the
  other 10 locales (de, es, fr, pl, pt, ru, tr, uk, zh + en itself) were
  properly localized. Users on these 4 locales would have silently seen
  English mid-sentence in the stage header ("Looking…", "You're first in
  line…", " · reconnecting") instead of their language.

## Fix
Translated the 3 stub keys in each of the 4 affected locales, matching the
tone/register already used by the other translated keys in the same file
(e.g. formal "Вие/Ви" in bg/sr matching existing `queueInPool` wording):

- `mobile.live.looking`
- `mobile.live.firstInLine`
- `mobile.live.reconnecting`

## Files touched
- `mobile/src/i18n/overlay/ar.json`
- `mobile/src/i18n/overlay/bg.json`
- `mobile/src/i18n/overlay/cs.json`
- `mobile/src/i18n/overlay/sr.json`

## Verify commands run
- `python3 -c "json.load(...)"` on all 4 edited files — valid JSON.
- Python scan of all 14 overlay files confirming all 7 `LiveSearchLabel`
  keys are present and no longer match the English `en.json` value in any
  non-English locale.
- `node mobile/scripts/test-live-units.mjs` → `live-units OK (6)`, all
  passing.

## Connect risk
none — i18n string-only changes in overlay JSON files. No edits to
`LiveSearchLabel.tsx`, `live.tsx`, or any connect/offer/ICE/TURN path.

COMPLETE
