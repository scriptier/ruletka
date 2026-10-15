# 453 — Friends Signal look S2–S4

Status: COMPLETE

## Files touched

- `mobile/app/friends.tsx`
- `mobile/src/friends/FriendChatSheet.tsx` (S5, small header polish)

## What changed

**S2 — Header / requests**
- Incoming friend requests: raw text row → circular letter avatar (`signalAvatarColor` seeded, matches friend-row palette) + soft filled Accept pill (`acceptBtnSoft`, green-tinted) + ghost Decline (kept `ghostBtn`).
- Outgoing "waiting" requests: row dimmed (`rowMuted`, opacity 0.68), name muted (`nameMuted`), Cancel is now a plain text button (`cancelTextBtn`, no pill background) instead of a ghost pill.
- Offline retry strip untouched.

**S3 — Call history**
- `CallHistRow` avatar bumped 40px → 50px circular (Signal range).
- Labeled `histCallBtn`/`histCallBtnMuted` (icon + "Call"/"Ring anyway" text pill) replaced with icon-only `callIconOnly`/`callIconOnlyMuted` (40px circular, blue when online, muted gray when offline) — same as the icon already used on `FriendRow`. Still tappable when offline → existing ring-anyway confirm flow via `callFromHistory`.
- Removed now-dead `histCallBtn*` styles.

**S4 — Match history density**
- `matchActions` reduced from up to 5 chips (Add friend / Copy code / Report / Block / Dismiss) to at most 2 primary + one overflow:
  - Primary: **Add friend** (if `friend_code` and not already a friend) or **Call** (`matchActCall`, blue-tinted, if already a friend — calls `call(fr)` directly).
  - **"…" overflow** (`matchActMore`, `ellipsis-horizontal` icon) opens an `Alert.alert` with Copy code (if code present) / Report / Block / Dismiss / Cancel — reuses existing `reportMatchHistory` / `blockMatchHistory` / `removeMatchHistory` handlers, just relocated out of inline chips.
  - Thumbs / letter tiles (`MatchThumbLetter`) untouched.
  - Removed now-dead `matchActGhost`, `matchActTextMuted`, `matchActTextWarn` styles.

**S5 (optional, small) — FriendChatSheet header**
- Added optional `onCall?: () => void` prop; renders an icon-only `videocam` button in the sheet header next to name/status (Signal thread-header spirit).
- Wired from `friends.tsx`: tapping it closes the chat sheet and calls the existing `call()` flow for that friend.

**Bug fix (pre-existing, in scope since it's in `friends.tsx`)**
- `FriendRow`'s call icon referenced `styles.callIconOnly` / `styles.callIconOnlyMuted`, which were never defined in the stylesheet (S1 shipped with this dangling reference) — the button rendered with no circular background/tap-target styling. Same for several other undefined style refs from S1 (`rowPressed`, `nameUnread`, `rowTime`, `rowTimeUnread`, `previewRow`, `unreadPill`, `unreadPillText`). All now defined; `CallHistRow`'s new icon-only button reuses `callIconOnly`.

## Verify commands run

```
cd mobile && npx tsc --noEmit -p .
```
Before my changes, `friends.tsx` had 9 TS2339 errors (missing style properties) plus the pre-existing `expo-clipboard` module-resolution error (present repo-wide, unrelated — no `@types` for that package in this environment). After my changes: only the `expo-clipboard` module error remains in `friends.tsx` (same as every other file in the app that imports it) — zero new errors, zero remaining style errors. `FriendChatSheet.tsx` diff introduced no new errors either.

Also did a manual brace-balance sanity check on the full file (0 net depth) after edits.

## Connect risk

**None.** Did not touch `mobile/src/media/*`, `live.tsx`, hub, TURN/ICE, or MediaSession. All edits confined to `friends.tsx` presentation/rows and `FriendChatSheet.tsx` header — the `call()` / `hub.callFriend` / offer flow itself is untouched, only which UI element triggers it.

COMPLETE
