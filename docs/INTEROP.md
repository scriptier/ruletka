# Nextface interop & federation (`nextface-fed/1`)

Share **stranger match pools** between cooperating bridge instances.  
Video/audio stay **WebRTC P2P** between browsers; bridges only match + relay SDP/ICE/chat.

This does **not** pull users from closed commercial Chat Roulettes.  
It only interconnects servers that implement this protocol (or a compatible gateway).

## Goals

1. Advertise free peers (`waiting`) to partner hubs  
2. **Claim** one waiting solo stranger across hubs  
3. Relay **WebRTC signals** (and chat) for the federated session  
4. Keep auth simple (shared secret) for demo / private meshes  

## Protocol version

```
nextface-fed/1
```

## Concepts

| Term | Meaning |
|------|---------|
| **Instance** | One `roulette-bridge` process with a stable `instance_id` |
| **Base URL** | Public HTTP(S) origin of the bridge (e.g. `https://a.example.com`) |
| **Claim** | Hub B asks hub A for one waiting solo peer; A dequeues and matches |
| **Federated peer id** | `fed/{session_id}/{original_peer_id}` — used in browser `signal.to` |

Media never crosses the federation HTTP path (except if you force TURN).

## HTTP API

All federation routes are under `/v1/federation/…`.  
CORS is permissive on the bridge (demo).

### Auth

Mutating endpoints require:

```http
Authorization: Bearer <ROULETTE_FEDERATION_TOKEN>
```

If the token is unset on a bridge, it **publishes info** but **rejects claims** (`accepts_claims: false`).

### Claim peer list

Outbound claims try each peer base every ~2s while a local user is waiting solo:

| Source | Change without restart? |
|--------|-------------------------|
| `ROULETTE_FEDERATION_PEERS` (env/CLI) | No |
| `data/federation_peers.json` via admin | **Yes** |

Admin (token required):

```http
POST /v1/admin/federation_peers
Authorization: Bearer <ROULETTE_ADMIN_TOKEN>
{"action":"add"|"remove","base":"https://partner.example.com"}
```

Status: `GET /v1/admin/mesh` → `federation.peers_env` / `peers_file` / `peers_effective`.

### `GET /v1/federation/info`

Public snapshot (no auth).

```json
{
  "protocol": "nextface-fed/1",
  "instance_id": "hub-a",
  "online": 12,
  "waiting_solo": 3,
  "waiting_total": 4,
  "accepts_claims": true,
  "rooms": [{ "room": "", "waiting_solo": 2 }, { "room": "ru", "waiting_solo": 1 }],
  "public_base": "https://a.example.com"
}
```

### `POST /v1/federation/claim`

Auth required. Caller has a local waiting user and wants a partner on this hub.

**Request**

```json
{
  "room": "",
  "caller_instance_id": "hub-b",
  "caller_base_url": "https://b.example.com",
  "remote_peer": {
    "peer_id": "aabbcc…",
    "short_id": "aabbccdd",
    "user_id": "u-…",
    "name": "Alex"
  }
}
```

**Response `200`**

```json
{
  "protocol": "nextface-fed/1",
  "session_id": "…",
  "session_key": "…",
  "claimed_peer": {
    "peer_id": "ddeeff…",
    "short_id": "ddeeff00",
    "user_id": "u-…",
    "name": "Sam"
  },
  "caller_is_offerer": true
}
```

**Errors**

| Status | Meaning |
|--------|---------|
| 401 | Bad/missing token |
| 404 | No free solo peer in that room |
| 503 | Federation disabled / full |

On success, this hub:

1. Removes one **solo** waiter from the queue (same `room`)  
2. Sends browser `matched` with mode `solo` and a federated peer id  
3. Remembers a session for signal/chat relay  

### `POST /v1/federation/relay`

Auth required. Deliver a signal or chat into an existing federated session.

```json
{
  "session_id": "…",
  "kind": "signal",
  "from_peer": "fed/{session}/{sender_original_peer_id}",
  "to_peer": "fed/{session}/{target_original_peer_id}",
  "signal_kind": "offer",
  "payload": "{…sdp…}",
  "author": "Alex"
}
```

Chat:

```json
{
  "session_id": "…",
  "kind": "chat",
  "author": "Alex",
  "body": "hi"
}
```

## Browser protocol (unchanged shape)

Clients still speak the existing WebSocket protocol (`hello`, `spin`, `next`, `signal`, `chat`, …).  
After a federated match they receive normal `matched` with:

```json
{
  "type": "matched",
  "mode": "solo",
  "peers": [{
    "peer_id": "fed/{session_id}/{remote_peer_id}",
    "short_id": "…",
    "user_id": "…",
    "name": "…",
    "is_offerer": true,
    "role": "stranger"
  }]
}
```

`live.js` already demuxes by `peer_id` / `to` — no UI change required for the happy path.

## Operator setup

### Hub A

```bash
export ROULETTE_INSTANCE_ID=hub-a
export ROULETTE_FEDERATION_TOKEN=shared-secret
export ROULETTE_PUBLIC_BASE=https://a.example.com   # reachable by hub B
export ROULETTE_FEDERATION_PEERS=https://b.example.com
./scripts/run-bridge.sh
```

### Hub B

```bash
export ROULETTE_INSTANCE_ID=hub-b
export ROULETTE_FEDERATION_TOKEN=shared-secret
export ROULETTE_PUBLIC_BASE=https://b.example.com
export ROULETTE_FEDERATION_PEERS=https://a.example.com
./scripts/run-bridge.sh
```

Each hub periodically tries to claim partners for local solo waiters from configured peers.

### Health

`GET /health` includes:

```json
{
  "federation": {
    "protocol": "nextface-fed/1",
    "instance_id": "hub-a",
    "accepts_claims": true,
    "peers": 1,
    "sessions": 0
  }
}
```

## Match rules (v1)

- Only **solo ↔ solo** across federation (no party mesh yet)  
- Same **room** string (empty = public)  
- Blocks/friends remain **local** to each hub  
- Immediate rematch avoidance is local-only  

## Security notes

- Shared token is demo-grade — use a private network or rotate secrets  
- Prefer HTTPS public bases  
- Rate-limit claims in production (not fully hardened in v1)  
- Do not federate untrusted open internet hubs without abuse controls  

## Roadmap

| Version | Feature |
|---------|---------|
| fed/1 | Solo claim + signal/chat relay (this doc) |
| fed/1.1 | Party-of-2 across hubs |
| fed/1.2 | Signed instance keys instead of shared secret |
| fed/2 | Directory / super-hub discovery |

## Relationship to Freenet

Freenet lobby contracts remain a **decentralized** control plane research path.  
Federation is the **practical multi-operator** path for product demos today.
