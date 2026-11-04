# Friends → Signal-like list (Android)

**Status:** in progress (seed ship 2026-08-12 night)  
**OWN:** `mobile/app/friends.tsx` (+ optional `FriendChatSheet.tsx` later)  
**Not OWN:** MediaSession, live.tsx SoftBlur, hub/TURN

## Goal

Make **Friends** feel closer to **Signal’s conversation list** — calm, chat-first, large avatars, minimal chrome — without losing ruletka actions (call, invite, codes, match history).

## DONE WHEN (human)

1. After open Friends: rows look **conversation-list** (not button soup).
2. **Tap row** → DM sheet. **Long-press** → copy / call / remove / block.
3. **Videocam/call icon** alone on the right (no “Chat” + “Call” text pills).
4. **Online** = green avatar dot only (no Online/Offline text chips on every row).
5. **Unread** = blue pill on preview line + bold name/time.
6. Search pill with magnifier when any friends exist.
7. Your-code hero still works (share/copy); denser but not removed.
8. Incoming/outgoing requests + match/call history still reachable.

## EVAL (agent)

| Check | How |
|-------|-----|
| `FriendRow` is single `Pressable` chat surface | grep/read `friends.tsx` |
| No labeled Chat CTA on friend rows | no `ctaBtn` + chatbubble label on FriendRow |
| `callIconOnly` + `videocam`/`person-add` | styles + row |
| `formatRowTime` + `last_msg_ts` sort | sort online/recent |
| `tsc` / metro no syntax break | optional typecheck |
| a11y labels still include name + online + preview | FriendRow a11yLabel |

## CHECKPOINTS

| # | Ship | Owner |
|---|------|--------|
| **S1** | Seed Signal row (avatar 52, time, preview, icon call, long-press) | Grok (done night of seed) |
| **S2** | Compact hero + request rows Signal polish (accept as soft chips) | overnight subagent |
| **S3** | Call history rows: icon-only call like Signal, circular avatars | overnight |
| **S4** | Match history: less chip-soup; overflow “…” for report/block | overnight |
| **S5** | FriendChatSheet header closer to Signal (name · avatar · call) | overnight if time |
| **S6** | Human smoke on device + optional APK tip bump | morning |

## Hard rules

- **Do not** invent multi / SoftBlur / GOAL_MET here.
- **Do not** thrash live/WebRTC while polishing Friends.
- Keep friend **codes**, invite join, offline ring — product needs them.
- One writer on `friends.tsx` at a time (worktree if Claude).

## Seed changes (S1)

- Solid Signal-palette letter avatars
- Recent `last_msg_ts` sort, then online, then name
- Search always when `friends.length > 0`
- Full-bleed rows, pressed state, blue unread pill

## Morning smoke

```
Open Friends → list looks like chats
Tap friend → chat sheet
Long-press → actions
Tap videocam → ring / live
Search filters
Share/copy code still works
```
