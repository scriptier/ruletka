# Friends + party browse

## Goals

1. **Add friends** via a short friend code  
2. **Call when online** (1:1 WebRTC through the bridge)  
3. **Browse strangers together** as a party of **exactly 2**  
4. Match shapes **only** (hard caps — nothing larger):

| Mode | Layout | How |
|------|--------|-----|
| **1v1** | You ↔ one stranger | Solo Next vs solo |
| **1v2** | You ↔ two party members (vertical split) | Solo matches a browsing party |
| **2v2** | Your party of 2 ↔ their party of 2 | Two parties match each other |

No 3-person parties, no 3v1, no 3v2, etc. Max **4** people in a stranger session.

## Roles

| Role | Sees |
|------|------|
| Solo in 1v1 | One partner full-size |
| Solo in 1v2 | Two party videos stacked vertically |
| Party member in 1v2 | Stranger full-size + friend (already connected) |
| Party member in 2v2 | Two strangers stacked + friend (already connected) |

## Flow

```
A ──add_friend(code)──► B
A ──call_friend───────► B  (ring → accept)
A/B 1:1 WebRTC (friend mode)
A or B ──browse_together──► both enter queue as party of 2

Then either:
  Solo S ──spin──► 1v2 with party (S ↔ A, S ↔ B; A↔B already up)
  Party C/D waiting ──► 2v2 with A/B (each side ↔ two strangers; friends already up)
```

## Matchmaking rules

- Party size is always **2** (friend pair only)  
- Queue entries: `Solo` or `Party { a, b }` only  
- Allowed pairs: solo–solo, solo–party, party–party  
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
