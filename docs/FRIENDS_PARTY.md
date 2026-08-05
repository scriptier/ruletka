# Friends + party browse

## Goals

1. **Add friends** via a short friend code  
2. **Call when online** (1:1 WebRTC through the bridge)  
3. **Browse strangers together** as a party of **2 or 3**  
4. Match shapes (hard caps — max **4** people in a stranger session):

| Mode | Layout | How |
|------|--------|-----|
| **1v1** | You ↔ one stranger | Solo Next vs solo |
| **1v2** | You ↔ two party members | Solo matches a browsing party of 2 |
| **3v1** | You ↔ three party members | Solo matches a browsing party of 3 |
| **2v2** | Your party of 2 ↔ their party of 2 | Two parties of 2 match each other |

Party of 3 forms after a 3-way mesh (Find 3rd / friend joins your call). Then **Find stranger together (3v1)** queues all three for one solo.

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

- Queue entries: **`Solo`**, **`Party` (2)**, or **`Party3` (3)**  
- Allowed pairs: solo–solo, solo–party2 (**1v2**), solo–party3 (**3v1**), party2–party2 (**2v2**)  
- Party3 does **not** match another party (only a solo)  
- Stranger-formed parties (`stranger_party`) do not 2v2 each other  
- Leader for queue actions: either member’s Next/Browse re-queues the party  
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
