# 076 — LiveStatusBanners a11y — RESULT

## Status
COMPLETE

## Audit findings
- `theyMutedMe` banner had `accessibilityRole="alert"`, but the sibling `partnerMuted`
  banner had no accessibility role at all — inconsistent status semantics between two
  visually/functionally parallel rows.
- The blur-row `Pressable`'s `accessibilityLabel` only carried `unblurLabel` (the action,
  e.g. "Show video"). Screen-reader users heard the action but never the current state
  ("Privacy veil on") that sighted users see in the banner text — state was silently
  dropped for assistive tech.
- Decorative emoji (🔇, 👁) were plain text nodes inside the announced string, so
  TalkBack/VoiceOver would read out emoji glyph names ("muted speaker", "eye") before
  the actual label, adding noise to every announcement.
- All three visible strings (`theyMutedLabel`, `partnerMutedLabel`, `blurredLabel`,
  `unblurLabel`) are already passed in as translated `t()` values from `app/live.tsx`
  (`mobile.live.theyMutedYou`, `youMutedThem`, `blurTitle`, `unblur` — verified present
  in both `en.json` and `ru.json`), so no new i18n keys were needed.

## Fix (minimal diff, `mobile/src/live/LiveStatusBanners.tsx` only)
- Added `accessibilityRole="alert"` to the `partnerMuted` banner to match `theyMutedMe`.
- Wrapped the emoji glyphs in a nested `<Text accessibilityElementsHidden
  importantForAccessibility="no">` so they're hidden from the accessibility tree while
  staying visible on screen.
- Changed the blur button's `accessibilityLabel` to combine `blurredLabel` +
  `unblurLabel` (state + action), mirroring the visible `Text`, and dropped the
  hardcoded English-only fallback pattern in favor of the same fallback strings already
  used for the visible text (still English fallback only if props are omitted, matching
  existing behavior — callers always pass translated props today).

## Files touched
- `mobile/src/live/LiveStatusBanners.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — no errors in `LiveStatusBanners.tsx`;
  pre-existing unrelated errors in other files (missing optional native modules like
  `expo-clipboard`, `react-native-gesture-handler` — not installed in this worktree —
  and pre-existing issues in `app/live.tsx`, `src/media/MediaSession.ts`).
- `grep` confirmed `mobile.live.theyMutedYou`, `youMutedThem`, `blurTitle`, `unblur`
  keys exist in both `src/i18n/overlay/en.json` and `src/i18n/overlay/ru.json`.

## Connect risk
none — no changes to `MediaSession`, offer/answer/ICE path, or connect timing. Purely
presentational/accessibility changes to a bottom-chrome banner component.

COMPLETE
