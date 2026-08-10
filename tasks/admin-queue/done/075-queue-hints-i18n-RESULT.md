# 075 — LiveQueueHints i18n / a11y

## Status
COMPLETE

## Audit findings
All visible strings in `LiveQueueHints.tsx` are already passed in via `labels` props, sourced from `t()` calls in `mobile/app/live.tsx:4194-4204` (`mobile.live.longSearchTitle`, `mobile.live.longSearchBody`, `mobile.live.invite`, `btn.stop`, `friends.aloneInviteTitle`, `friends.aloneInviteBody`, `mobile.friends.yourCode`, `mobile.live.copyLink`, `mobile.friends.shareInvite`). No hardcoded/untranslated strings found, so no new en.json/ru.json keys were needed.

Gap found: the 4 `Pressable` buttons (invite, stop, copyLink, shareInvite) had no `accessibilityRole`/`accessibilityLabel`, and the 2 card titles had no `accessibilityRole="header"` — inconsistent with the pattern used elsewhere in `live.tsx` (e.g. lines 3870-3871, 4096-4097) and `src/identity/PartnerChrome.tsx:115`.

## Fix
- Added `accessibilityRole="button"` + `accessibilityLabel={<localized label>}` to all 4 `Pressable` buttons.
- Added `accessibilityRole="header"` to the long-search and alone-card titles.
- No behavior/layout/style changes.

## Files touched
- `mobile/src/live/LiveQueueHints.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — pre-existing unrelated errors only (missing native modules, other files); zero errors in `LiveQueueHints.tsx`.

## Connect risk
none — no changes to connect path, MediaSession, or ICE/offer logic. Pure a11y prop additions to an already-conditionally-rendered UI component.

COMPLETE
