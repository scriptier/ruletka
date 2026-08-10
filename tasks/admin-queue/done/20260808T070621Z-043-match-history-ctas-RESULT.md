# RESULT: 043-match-history-ctas

## Status
DONE

## Completion promise
COMPLETE

## What changed
- Call-history rows on the Friends screen (the "Recent calls" section built from `history`/`CallHistoryEntry`, `friends.historyTitle`) now show a labeled pill CTA instead of an icon-only circle button.
- Online → green pill, phone icon + "Call back" label (`mobile.history.callBack`), reusing the same green (`#2d9f6f`) used elsewhere for primary call actions.
- Offline → muted pill (translucent gray background, muted text/icon color), phone-outline icon + "Ring anyway" label (`mobile.history.ringAnyway`) — offline contacts can still be rung, just visually de-emphasized.
- No new i18n keys needed; both strings already existed (previously only used as `accessibilityLabel`, now also rendered visibly).
- `callFromHistory(h)` handler and its offline-confirmation Alert flow are untouched — purely a UI/style change, no WebRTC/offer logic touched.
- Did **not** touch the match-history (roulette-partner) card section above it — that section has no call button today (add-friend/copy-code/report/block/dismiss only) and was out of scope per the task's "history section only" restriction; the labeled-Call requirement applied to the call-history rows, which were the ones still icon-only.

## Files
- mobile/app/friends.tsx (history row JSX + two new styles: `histCallBtn`, `histCallBtnMuted`, `histCallBtnText`, `histCallBtnTextMuted`)

## Verify ran
- Manual review of JSX/style balance.
- `npx tsc --noEmit -p .` from `mobile/` — required a temporary symlink of `node_modules` from the main checkout (this worktree has no installed deps); removed the symlink immediately after. Result: no errors on the touched lines (990–1020, ~1357–1380). Pre-existing errors remain in this file for `../src/calls/matchHistory`, `../src/calls/matchThumbs`, `../src/analytics/track`, `../src/friends/FriendChatSheet`, `../src/feedback/haptics`, `../src/identity/flagTrust`, `../src/push/notifOptIn`, `../src/safety/blocks`, `../src/safety/reportHistory`, plus one implicit-any and one arg-count mismatch — all pre-date this change: those source files exist only as **untracked** files in the main `/home/drakosik/freenet-roulette/mobile` checkout (another agent's in-progress work, never committed), so they're invisible to this git worktree. Not touched, per "only fix files you changed."

## Connect risk
safe to merge after smoke (no connect/offer/WebRTC paths touched — pure Friends-screen UI)

## Handoff for morning
- merge branch: admin/20260808T070621Z-043-match-history-ctas
- smoke: open Friends screen with existing call history entries, confirm labeled "Call back" (online, green) / "Ring anyway" (offline, muted) pill renders correctly and still places the call/ring on tap
- do not: deploy without Play↔PC check
- note: the untracked source files referenced above (matchHistory.ts, FriendChatSheet.tsx, etc.) exist in the main checkout but aren't committed — worth getting that other agent's work committed so future worktrees/tsc runs aren't broken by missing modules
