# 453 — Friends Signal look S2–S4

## Context

Spec: `knowledge/specs/FRIENDS-SIGNAL-LOOK.md`  
S1 already shipped in `mobile/app/friends.tsx` (Signal conversation rows).

## OWN (only)

- `mobile/app/friends.tsx`
- Optionally `mobile/src/friends/FriendChatSheet.tsx` if header polish is small

## Do NOT touch

- `mobile/src/media/MediaSession.ts`, SoftBlur, live WebRTC, hub, coturn, APK deploy

## Tasks

### S2 — Header / requests
- Incoming friend requests: circular letter avatar + Accept (filled soft) / Decline (ghost) — less raw buttons
- Outgoing “waiting”: muted row + Cancel text button
- Keep offline retry strip

### S3 — Call history
- Match `CallHistRow` to Signal: 48–52 circular avatar, name + kind·time preview
- Right: **icon-only** call (videocam/call), not wide labeled “Call” / “Ring anyway”
- Offline = muted icon (still tappable → existing ring-anyway flow)

### S4 — Match history density
- Primary actions: Add friend (if code) + Call if already friend
- Move Report / Block / Dismiss into long-press or `…` overflow Alert (reduce chip soup)
- Keep thumbs / letter tiles

### S5 (optional)
- FriendChatSheet top bar: avatar + name + call icon (Signal thread header spirit)

## DONE WHEN

- File still typechecks (no new TS errors)
- RESULT lists files + what changed
- No MediaSession / live thrash

## RESULT path

Write `tasks/admin-queue/done/453-friends-signal-s2-s4-RESULT.md` with Status + files + connect risk (none expected).
