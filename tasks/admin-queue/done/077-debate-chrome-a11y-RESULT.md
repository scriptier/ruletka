# 077 — LiveDebateChrome labels (a11y + i18n)

## Status
COMPLETE

## What changed
Audited `mobile/src/live/LiveDebateChrome.tsx` for accessibility/i18n gaps. All
interactive controls (pass, end, decline, accept, cancel, send invite, turn-length
chips, topic input) already had `accessibilityRole`/`accessibilityLabel`. Found and
fixed two real gaps:

1. **Turn-length chips used a raw, unlocalized label.** The 5/10/15/20/30/45/60s
   selector buttons had `accessibilityLabel={`${s}s`}` — hardcoded English shorthand
   read literally by screen readers (e.g. "30s") and never translated. Added a new
   `turnSecondsOption(s)` label backed by a new i18n key so screen readers announce
   e.g. "30 seconds" / "30 секунд" in the user's language.
2. **Muted-turn hint wasn't excluded from the accessibility tree.** The debate chip
   is a single `role="summary"` region with one combined `accessibilityLabel`; every
   child `Text`/`View` is marked `importantForAccessibility="no"` so screen readers
   read the summary once instead of the summary *and* each child. The "Muted until
   your debate turn" `Text` (rendered when it's not your turn) was missing that
   prop, so it would double-announce and break the summary pattern its siblings
   follow. Added `importantForAccessibility="no"` to match.

## Files touched
- `mobile/src/live/LiveDebateChrome.tsx` — add `turnSecondsOption` to `labels` prop
  type, use it for the turn-length chip `accessibilityLabel`, add
  `importantForAccessibility="no"` to the muted-turn hint `Text`.
- `mobile/app/live.tsx` — wire `turnSecondsOption: (s) => t("debate.turnSecondsOption", { s })`
  into the `LiveDebateChrome` `labels` prop (only caller of the component).
- `mobile/src/i18n/overlay/en.json` — add `debate.turnSecondsOption`: "{s} seconds".
- `mobile/src/i18n/overlay/ru.json` — add `debate.turnSecondsOption`: "{s} секунд".

No other locale files touched (task scope limited to en/ru); other overlay locales
will fall back to the English string for this one key until translated, same as any
newly added key.

## Verify commands run
- `python3 -c "json.load(...)"` on `en.json` and `ru.json` — both parse cleanly.
- `npx tsc --noEmit -p .` (mobile) — pre-existing baseline errors only (missing
  native modules like `expo-clipboard`, `react-native-gesture-handler`, unrelated
  `live.tsx`/`MediaSession.ts` issues that predate this change). No new errors, and
  none reference `LiveDebateChrome.tsx` or the touched `live.tsx`/i18n lines.

## Connect risk
none — no changes to MediaSession, offer/answer/ICE, TURN, or connect path. Pure
label/copy changes in the debate chrome UI and its i18n strings.

COMPLETE
