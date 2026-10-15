# 454 — FriendChatSheet bubbles → Signal-ish (residual)

## Context
Spec: `knowledge/specs/FRIENDS-SIGNAL-LOOK.md`
S1–S5 seed already on **main tree** (`friends.tsx` + chat header). Do **not** re-architect friends list.

## OWN (only)
- `mobile/src/friends/FriendChatSheet.tsx`

## Do
1. Outgoing bubbles: soft blue (`#3d7eff` family), white text
2. Incoming: dark gray bubble (`#1c212b`), light text
3. Rounder bubble corners (Signal spirit ~16–18 radius)
4. Keep long-press copy + a11y
5. Compose row: slightly taller, send as icon if easy else keep text

## Must not
- Touch `friends.tsx`, MediaSession, live, hub
- Deploy / APK

## RESULT
`tasks/admin-queue/done/454-friends-chat-bubble-signal-RESULT.md` with COMPLETE
