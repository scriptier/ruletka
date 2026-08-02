# Client ↔ hub protocol (ruletka-signal)

Version sketch for **simple bridge** mode. Source of truth: `bridge/src/protocol.rs` + UI `ui/live.js` / `ui/webrtc.js`.

Media is **never** carried on this channel — only matchmaking, chat text, and WebRTC SDP/ICE signaling.

## Transport

| Item | Value |
|------|--------|
| HTTP UI / config | `GET /`, `/live.html`, `/config.json`, `/health` |
| Signaling | WebSocket **`/ws`** (same origin or hub base) |
| Encoding | JSON text frames |
| Identity | Client supplies stable `user_id` (browser storage); hub does not issue accounts |

Discover ICE servers from **`GET /config.json`** (`ice_servers`, `has_turn`, notes). Camera requires a secure context (HTTPS or localhost).

## Envelope

Messages use a `type` discriminant (`snake_case`):

```json
{ "type": "hello", "user_id": "…", "name": "anon", "gender": "", "looking": "any", "flag": "", "avatar": "", "tags": [] }
```

Unknown fields should be ignored by both sides for forward compatibility.

## Client → server (`ClientMsg`)

| type | Role |
|------|------|
| `hello` | Register identity + soft prefs |
| `set_prefs` | Update gender/looking/flag/avatar/tags |
| `spin` / `next` | Join or re-join stranger queue (`room` optional) |
| `stop` | Leave queue / end stranger match |
| `set_room` | Room preference (if rooms enabled) |
| `chat` | In-match chat body |
| `signal` | WebRTC: `kind` + `payload` (+ `to` peer_id for multi-party) |
| `ping` | Keepalive |
| `add_friend` / `accept_friend` / `decline_friend` / `remove_friend` | Friend graph by `code` / `user_id` |
| `call_friend` / `call_respond` / `call_cancel` / `hangup_friend` | Friend call ring |
| `browse_together` | Party of 2 enters stranger queue |
| `find_third_invite` / `find_third_respond` / `find_third_cancel` | Optional trio |
| `block_user` / `unblock_user` | Social block |
| `report_user` | Moderation report |
| Star spend / rate messages | See `protocol.rs` for gift / rate variants |

## Server → client (`ServerMsg`)

| type | Role |
|------|------|
| `hello_ok` | `client_id`, `peer_id`, `user_id`, `friend_code`, stars/trust fields, rate windows |
| `status` | Queue/online phase (`phase`, `waiting_peers`, `online`, …) |
| `matched` | Session + who to connect to (`peers[]`, `is_offerer`, `mode`) |
| `chat` / `friend_chat` / `friend_chat_history` | Text |
| `signal` | Relayed WebRTC (`kind`, `payload`, `from_peer`) |
| `error` | Human-readable message |
| Friend / call / stars events | Presence, rings, balances — see `protocol.rs` |

## Match loop (1:1 stranger)

1. Client connects WebSocket → `hello` → `hello_ok`
2. `spin` or `next` → `status` while waiting
3. `matched` with `peers` → create `RTCPeerConnection` using `/config.json` ICE
4. Exchange `signal` (`offer` / `answer` / `ice` — exact `kind` strings used by UI)
5. Media on PC only; chat via `chat`
6. `next` / `stop` ends session

## Friends

- Codes are issued on `hello_ok.friend_code`
- Friendship is mutual accept; stored on the hub under `user_id`
- Calls use ring/respond; media still P2P after accept

## Stars (hub-local)

- Balances live in hub **star ledger** (not in profile export)
- Import/export of profile **must not** trust client-supplied star fields
- Federation of stranger pool does **not** merge star ledgers across hubs

## Security notes for implementers

- Treat the hub as **semi-trusted** for match + chat; not a video server
- Partners can record; Block/Report are social controls
- Rate-limit client frames; validate sizes (`ROULETTE_MAX_FRAME`)
- Do not open federation claim/relay to untrusted peers

## Compatibility

When breaking wire format, bump a documented revision (e.g. note in `hello_ok` or `/config.json`). Prefer additive fields.

Reference UI: `ui/live.js`, `ui/webrtc.js`. Reference server: `bridge/src/simple.rs`, `bridge/src/protocol.rs`.
