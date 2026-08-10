# RESULT: 074-index-build-badge-copy

## Status
DONE

## What changed
- Home screen's build badge (`mobile/app/index.tsx`, bottom of `HomeBody`)
  previously just rendered `appVer`/`buildN` as static, non-interactive
  `Text` with no way to copy it and no hint. Settings already had a
  matching pattern (long-press to copy build label, with an inline hint
  line and toast) using `mobile.settings.buildCopied` /
  `mobile.settings.buildCopyHint`, both already translated EN+RU.
- Wrapped the home build badge in a `Pressable` with `onLongPress`
  (`delayLongPress={400}`, matching the hub-status row above it) that
  copies `"{appVer} ({buildN})"` to the clipboard via the already-imported
  `Clipboard.setStringAsync`, shows a toast (reusing
  `mobile.settings.buildCopied`), and fires `hapticLight()` — same
  pattern already used elsewhere on this screen (hub URL copy, friend
  code copy).
- Added a small visible hint line under the version text
  (`mobile.settings.buildCopyHint` → "Long-press to copy build for
  support" EN / "Long-press — скопировать версию для support" RU) plus
  an `accessibilityHint` on the Pressable, so support can find/copy the
  build version without guessing.
- No new i18n keys needed — reused the existing `mobile.settings.*` keys
  since they already exist in all locale overlays (EN+RU confirmed) and
  say exactly the right thing for this context.

## Files touched
- mobile/app/index.tsx (build badge: added Pressable + long-press copy +
  hint text + `buildBadgeHint` style)

## Verify commands run
- `npx tsc --noEmit -p .` in `mobile/` — pre-existing unrelated errors
  only (missing `expo-clipboard`/`expo-keep-awake`/etc. type
  declarations in this worktree's `node_modules`, present before this
  edit and elsewhere in the file/repo too); no new errors introduced by
  this change, confirmed via `grep index.tsx` on the tsc output (only the
  pre-existing `expo-clipboard` module-not-found line, from the import
  that already existed at the top of the file).
- Confirmed `mobile.settings.buildCopied` and `mobile.settings.buildCopyHint`
  exist in both `mobile/src/i18n/overlay/en.json` and
  `mobile/src/i18n/overlay/ru.json`.

## Connect risk
none — UI-only change to a static footer label on the home screen; no
Hub/connect/offer/ICE/TURN code touched.

COMPLETE
