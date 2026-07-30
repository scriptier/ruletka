# Deploy Chat Roulette on a local Freenet node

## Prerequisites

- `freenet` and `fdev` on PATH (you already have them under `~/.local/bin`)
- Rust + `wasm32-unknown-unknown` target

```bash
rustup target add wasm32-unknown-unknown
```

## 1. Start a local node

```bash
# terminal A
./scripts/run-local-node.sh
# WebSocket API: ws://127.0.0.1:7509/v1/contract/command
```

## 2. Build + publish the lobby contract

```bash
# terminal B
./scripts/publish-local.sh
```

This:

1. Builds `freenet_roulette_lobby.wasm` (and session wasm)
2. Writes empty lobby state CBOR via `roulette-tools`
3. Runs `fdev publish … contract --state lobby-state.cbor`

Copy the **contract key / instance id** from the command output (also written to
`target/publish/lobby-key.txt`) into the UI “Lobby contract key” field.

Example successful run:

```text
=== Lobby contract key ===
GCFF4Y6GxjuYF65UaLoUhqSiZQESKSRrFi1L87JAtXcK
```

(Key changes if the WASM binary changes — rebuild + re-publish after contract edits.)

## 3. Run the UI

```bash
python3 -m http.server -d ui 8787
# http://127.0.0.1:8787
```

- **Local sim** (default): dual-pane monoid demo, no node required  
- **Freenet node**: connect panel → WS URL + lobby key  

Full browser updates against Freenet need `@freenetorg/freenet-stdlib` and CBOR
encoding for deltas (Rust agent path is the production route). The panel
validates connectivity first.

## 4. Session contracts (after match) — **working**

Each match has a deterministic `SessionId`. The session WASM is parameterized by
`(session_id, peer_a, peer_b)` (`SessionParams` in `common`). After mutual claim the
agent:

1. **PUTs** `freenet_roulette_session.wasm` with those parameters  
2. **Updates** with CBOR `SessionState` (messages + WebRTC signal ring)  
3. Merges CRDT state from notifications  

## 5. Live match + chat with the Rust agent

```bash
./scripts/build-wasm.sh
cargo run -p freenet-roulette-agent -- dual
```

Flow: connect → lobby match → session PUT → chat → WebRTC signals (offer/answer/ice/bye) → leave lobby.

```bash
# Two separate processes (match only; each can open session later)
cargo run -p freenet-roulette-agent -- peer --seed 1 &
cargo run -p freenet-roulette-agent -- peer --seed 2
```

Source: `agent/` (`roulette-agent` binary).

## 6. Multi-tab browser video (bridge)

**Default: simple mode** — no Freenet node. In-memory match queue + WebSocket chat/signaling:

```bash
./scripts/run-bridge.sh
# or: cargo run -p freenet-roulette-bridge --release -- --mode simple
```

Open **two tabs**: [http://127.0.0.1:8790/live.html](http://127.0.0.1:8790/live.html)

1. **Connect** (auto on port 8790)  
2. **Preview** (optional cam/mic check before match)  
3. **Next** on each tab → FIFO match when ≥2 waiting  
4. Camera starts; SDP/ICE relayed over bridge WebSocket; media is P2P (STUN)  
5. Chat works on the same WebSocket  

Freenet control plane (research): contracts under `contracts/`, agent under `agent/`.  
Bridge Freenet hub needs `--features freenet` (currently stub — use CLI agent for Freenet matches).

## WebRTC

- **Simple mode signaling**: bridge relays `signal` messages (offer / answer / ice / bye)  
- **Freenet signaling**: `SessionState.signals` (Offer / Answer / Ice / Bye)  
- Media: browser `RTCPeerConnection` with public STUN only  
- Offerer: lexicographically smaller `PeerId`
## Troubleshooting

| Symptom | Check |
|---------|--------|
| publish fails | Is `freenet local` up? Port 7509 free? |
| huge WASM | Always `--release` + `freenet-main-contract` |
| getrandom on wasm | Contracts use `default-features = false` on common (no OsRng) |
| connect error from UI | CORS / wrong WS URL; node must allow local WS |
