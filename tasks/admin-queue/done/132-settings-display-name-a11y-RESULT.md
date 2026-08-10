# 132 — Settings display name field a11y — RESULT

## Status
COMPLETE (already compliant, no code change needed)

## Audit
`mobile/app/settings.tsx` display name `TextInput` (Profile section, ~line 597):
- Has `accessibilityLabel={t("mobile.settings.displayName")}` (line 604), reusing
  the existing i18n key already rendered as the visible `fieldLabel` above it
  (line 596) — same convention used for the export/import password fields and
  the friends code input in this codebase.
- Screen readers announce the label instead of the (hardcoded, untranslated)
  `placeholder="anon"`, so the placeholder's lack of localization does not
  affect the accessibility tree.
- `maxLength={32}` is a plain input constraint, not an a11y gap.

Compared against the file's other inputs and the established pattern from prior
a11y passes (export/import password, friends code, chat compose) — no missing
prop or inconsistency found. No new strings were needed and none were added.

## Files touched
- None (audit only; the field already had the correct `accessibilityLabel`
  wired to an existing t() key in the current working tree).

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — only pre-existing, unrelated
  errors (missing `expo-clipboard`/`expo-keep-awake`/`react-native-gesture-handler`
  type declarations, `live.tsx` issues); nothing on the display name field's
  lines.
- `grep -n accessibilityLabel mobile/app/settings.tsx` — confirms label present
  at line 604.

## Connect risk
none — audit-only, no edits, no changes to `mobile/src/media/*`, `live.tsx`,
WebRTC/offer/ICE/TURN, or prefs schema.

COMPLETE
