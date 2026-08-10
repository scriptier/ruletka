# 080 — Settings save button feedback polish — RESULT

**Status:** COMPLETE

## What changed
Accessibility audit of `mobile/app/settings.tsx`. The file had almost no
`accessibilityRole`/`accessibilityState`/`accessibilityLabel` on its ~25
`Pressable` controls (only the `Section` header toggle had any). Added
screen-reader affordances using existing, already-localized `t()` strings —
no new i18n keys were needed.

- `Chip` (shared toggle used for language / gender / looking-for / hide-IP /
  data-saver / live-layout / blur-mode / history-snaps / UI-sounds /
  notify-calls chips): added `accessibilityRole="button"` +
  `accessibilityState={{ selected: active }}` so screen readers announce
  toggle state on every chip group in one place.
- **Save prefs CTA** (both instances, Match section + Alerts section): added
  `accessibilityRole="button"`, `accessibilityState={{ disabled: busy, busy }}`,
  `accessibilityLabel` (mirrors visible "Save prefs" / "Saved ✓" text), and
  `accessibilityLiveRegion="polite"` so the "Saved ✓" feedback is announced by
  TalkBack when the button's own label changes — this was the main gap: sighted
  users get the checkmark flash, screen-reader users previously got nothing.
- Added `accessibilityRole="button"` to: more-languages expander, push
  register, open notification settings, open battery settings, hub reconnect,
  hub probe, export/import backup, unblock, clear report history, pin-to-home,
  open-on-PC, share app, copy support email, build-info long-press box.
- Hub row (server picker): added `accessibilityRole="button"` +
  `accessibilityState={{ selected: active }}`.
- Legal/safety link rows: `accessibilityRole="link"` (they open URLs).
- Added `accessibilityLabel` to the three `TextInput`s (display name, export
  password, import password) so the label persists after the placeholder
  disappears on typing.

No new strings were introduced; all labels reuse existing localized `t()`
keys already present in every language overlay (e.g.
`mobile.settings.save`/`saved`, `mobile.settings.displayName`,
`mobile.settings.exportPw`/`importPw`).

## Files touched
- `mobile/app/settings.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — no new errors introduced. The
  errors it reports (`expo-clipboard`, `react-native-gesture-handler`, etc.
  "Cannot find module") are pre-existing, caused by `node_modules` not being
  installed in this worktree, and are unrelated to this diff (same errors
  appear in untouched files like `app/live.tsx`, `app/friends.tsx`).

## Connect risk
none — no changes to `mobile/src/media/*`, `live.tsx`, offer/ICE/TURN, or any
connect-path code. Purely additive accessibility props on existing `Pressable`/
`TextInput` elements in Settings; no logic, styling, or string changes.

COMPLETE
