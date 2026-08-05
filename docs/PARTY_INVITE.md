# Adding a 3rd / 4th person

## Why the old “Call” dropped someone

Classic `call_friend` meant **private 1:1 ring**:

1. Hang up current match / friend call  
2. Ring the target  
3. On accept → new 1:1 only  

So if you were talking to B and called C, **B was dropped** when C accepted. That felt broken when the goal was “add C to the party.”

## What works now

### Invite into live 1v1 (join) — **new**

While you are in an **active 1v1** (friend call or stranger):

- Friends list → **Invite** (not plain Call)  
- Server sends `call_friend` with `join: true`  
- **Does not** hang up the other person  
- Target sees: *“X invites you to join their call with Y”* → **Join**  
- On accept → **3-person mesh**: keep A–B, add A–C and B–C WebRTC  

Layout:

| You are | Sees |
|---------|------|
| A or B (original pair) | Friend on main + joiner in 3rd column |
| C (joiner) | Split 1v2 of A and B |

### Classic private call

When **idle** (not in a call): Friends → **Call** still does private 1:1 (replace semantics).

### Find stranger together / Find 3rd

Still the path to hunt a **random stranger** with a friend (queue), not a specific friend invite.

| Goal | Action |
|------|--------|
| Add a **specific friend** as 3rd | In 1v1 → Friends → **Invite** |
| Find a **random** 3rd with friend | ⋯ → **Find stranger together** or **Ask friend · Find 3rd** |
| **4 people** | Two pairs of 2 each Browse / invite → match **2v2** (not “invite 4th into live 3 yet”) |

## 4th person (roadmap)

Not yet: invite a 4th into a live 3-way mesh.

Workarounds:

1. **2v2**: two friend pairs both enter party search → match each other  
2. Future: `join` while already `session_peers.len() == 2` → 4-mesh (3 new PC links)

## Protocol (join)

```json
{ "type": "call_friend", "user_id": "…", "join": true }
{ "type": "call_incoming", "join": true, "with_user_id": "…", "with_name": "…", … }
{ "type": "call_respond", "user_id": "…", "accept": true }
```

→ `matched` with `mode: party_browse` for all three (existing PCs kept for A–B).
