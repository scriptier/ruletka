# Architecture — Freenet Chat Roulette

Two control planes, one media plane. **Video/audio is always peer-to-peer** (WebRTC).  
Matchmaking + chat/signaling can be centralized (simple bridge) or Freenet contracts (research).

> **Brand:** **ruletka.vip** (homepage + live chat).  
> Served by `roulette-bridge` (e.g. `http://127.0.0.1:8790/` → `/live.html`).

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  Browser UI  (ui/live.html)  EN / RU                    │
│  camera/mic preview · devices · partner volume          │
└───────────────┬─────────────────────────┬───────────────┘
                │ WebSocket JSON            │ WebRTC media
                ▼                           ▼
┌───────────────────────────┐    ┌────────────────────────┐
│  Control plane (pick one) │    │  Media plane (always)  │
│                           │    │  RTCPeerConnection     │
│  A) Simple bridge (default)│   │  STUN (+ optional TURN)│
│     in-memory FIFO match  │    │  P2P A/V — not on server│
│     chat + SDP/ICE relay  │    └────────────────────────┘
│                           │
│  B) Freenet (research)    │
│     lobby monoid + claims │
│     session CRDT + signals│
│     agent/ + contracts/   │
└───────────────────────────┘
```

### What is decentralized today?

| Piece | Simple mode | Freenet mode |
|-------|-------------|--------------|
| Match queue | **Central** (bridge RAM) | **Contract monoid** (lobby WASM) |
| Chat text | Relay via bridge | Session contract CRDT |
| WebRTC SDP/ICE | Relay via bridge | Session signals |
| Camera/mic bits | **P2P only** | **P2P only** |
| Identity | Ephemeral UUID | ed25519 peer keys |

So even in simple mode, **media is not uploaded to a media server**. The bridge never sees video frames.

### Simple mode (product / demos)

- Binary: `roulette-bridge` (`bridge/`)
- Protocol: `bridge/src/protocol.rs` ↔ `ui/live.js`
- Optional **room codes**: peers only match inside the same room
- ICE from `GET /config.json` (`ROULETTE_STUN` / `ROULETTE_TURN`; default demo Open Relay TURN)
- Friends + **block list** persisted in `data/friends.json`
- **Federation** (`nextface-fed/1`): multi-hub stranger pool — see [`INTEROP.md`](INTEROP.md)
- Remote friends: HTTPS tunnel — see [`REMOTE_ACCESS.md`](REMOTE_ACCESS.md)

### Freenet mode (research)

- Design: [`LOBBY_DESIGN.md`](LOBBY_DESIGN.md), [`CLIENT_LOOP.md`](CLIENT_LOOP.md)
- Contracts: `contracts/lobby`, `contracts/session` (WASM)
- Agent: `roulette-agent` dual/peer CLI
- Deploy notes: [`FREENET_DEPLOY.md`](FREENET_DEPLOY.md)
- Browser Freenet hub in the bridge is not re-enabled yet (`--features freenet` stubs)

## Room codes (simple)

Empty room = public lobby. Same non-empty code = private pool (friends / testing).  
Does not encrypt media; only scopes matchmaking.

## Roadmap (decentralization)

1. Stable Freenet lobby on a public gateway  
2. Browser agent over Freenet WS (no match bridge)  
3. Optional Nostr signaling as a third control plane  
4. Room auth / rate limits for public tunnels  
