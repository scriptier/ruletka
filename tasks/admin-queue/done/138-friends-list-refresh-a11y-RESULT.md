# 138 — Friends RefreshControl a11y

## Status
COMPLETE

## Audit
`mobile/app/friends.tsx` FlatList uses a `RefreshControl` (pull-to-refresh on
the friends list) with no accessibility label, and the "Friends (N)" section
title text directly above it had no `accessibilityRole="header"` — inconsistent
with the header pattern already used elsewhere in the app (`ReportSheet.tsx`,
`LiveGiftBar.tsx`, `LiveDebateChrome.tsx`, `LiveQueueHints.tsx`). Screen-reader
users landing on the refresh region or scanning by headings had no meaningful
label/landmark for this area. `RefreshControlProps` extends `ViewProps`, so
`accessibilityLabel` passes through to the native control on both platforms.

## Fix (minimal, no new copy)
- `RefreshControl`: added `accessibilityLabel={t("mobile.friends.list", { n: sortedFriends.length })}` (reuses the existing "Friends (N)" key already used for the section title, so it stays in sync and doesn't need a translation update across all 14 locales).
- Section title `<Text style={styles.sectionTitle}>`: added `accessibilityRole="header"` so it's reachable as a heading landmark, matching the existing convention elsewhere in the app.

No new i18n keys added (task required reusing existing `t()` keys).

## Files touched
- `mobile/app/friends.tsx` (2 additive attribute changes, +9/-1 lines)

## Verify commands run
- `cd mobile && npx tsc --noEmit -p .` — no new errors from `friends.tsx`; the only error there (`Cannot find module 'expo-clipboard'`) is a pre-existing, repo-wide missing-`node_modules` issue also present on `index.tsx`, `settings.tsx`, `live.tsx`, `FriendChatSheet.tsx`, `OpenOnPcSheet.tsx` — unrelated to this change.
- `./scripts/dev-smoke.sh --unit` — all L0 unit tests pass (friend-invite, geo-localize, callMetrics, connectSteps, hubLobby, matchContinuity, stageStreams, blurMode, giftFxHold).

## Connect risk
none — UI-only accessibility attributes on the friends list screen; no changes to `mobile/src/media/*`, MediaSession, offer/ICE/TURN, or connect flow.

COMPLETE
