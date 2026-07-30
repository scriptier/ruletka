# Friends + party browse (MVP)

## Goals

1. **Add friends** via a short friend code  
2. **Call when online** (1:1 WebRTC through the bridge)  
3. **Browse strangers together** as a party of **max 2**  
4. Stranger sees **both** party members in a **vertical split**

## Roles

| Role | Sees |
|------|------|
| Solo stranger | Two party videos stacked vertically |
| Party member A/B | Stranger full-size + friend (already connected) |

## Flow

```
A ──add_friend(code)──► B
A ──call_friend───────► B  (ring → accept)
A/B 1:1 WebRTC (friend mode)
A or B ──browse_together──► both enter queue as party
Solo S ──spin──► matched with party
Mesh WebRTC:
  S ↔ A
  S ↔ B
  A ↔ B (already up)
```

## Matchmaking rules

- Parties only match **solo** strangers (not another party)  
- Party size max **2**  
- Leader for queue actions: either member’s Next/Browse re-queues both  
- Same **room** code scopes the public lobby as before  

## Signaling

```json
{ "type": "signal", "kind": "offer", "payload": "...", "to": "<peer_id>" }
{ "type": "signal", "author": "...", "from_peer": "...", "kind": "answer", "payload": "..." }
```

Offerer per pair: lexicographically smaller `peer_id`.

## Persistence

- `user_id` + `name` live in browser `localStorage`  
- Friendships, friend codes, names, and **blocks** live in `data/friends.json` (survive bridge restart)  
- **Block** removes friendship both ways and prevents stranger rematch either direction  

