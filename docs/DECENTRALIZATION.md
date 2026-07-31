# Decentralization model

**ruletka** (this repo) separates three things:

1. **Media** — always browser WebRTC (P2P when the network allows).
2. **Hub (bridge)** — match queue + chat + SDP/ICE signaling. Anyone can run one.
3. **Brand / default seed** — `https://ruletka.vip` is *one* public hub, not the only network.

## Goals

| Goal | How |
|------|-----|
| Site X down ≠ entire chat dead | Clients try other hubs from a public directory |
| Anyone can host | Open source bridge + UI; no license lock-in to one domain |
| Helpers useful alone | Full UI on helper nodes; island matchmaking on that hub |
| Optional shared stranger pool | Federation `nextface-fed/1` between **cooperating** operators |
| No random takeover | Federation claims require a shared token + peer allowlist |

## Hub directory (`ruletka-directory/1`)

Every bridge can publish:

- Static seed: `GET /hubs.json`
- Live snapshot: `GET /v1/directory`

Clients (`ui/hubs.js`):

1. Prefer `?hub=https://…` or saved preference  
2. Else same-origin hub (the site you opened)  
3. On repeated connect failure, walk the directory and switch hub  

Directory entries are **hints**, not trust roots. Operators curate `hubs.json` and `ROULETTE_DIRECTORY_HUBS`.

## Running your own hub

```bash
git clone <this-repo>
cargo build -p freenet-roulette-bridge --release
export ROULETTE_PUBLIC_BASE=https://your-hub.example.com
# optional: list other community hubs for client failover
export ROULETTE_DIRECTORY_HUBS=https://ruletka.vip,https://friend-hub.example.com
./target/release/roulette-bridge --mode simple --ui-dir ui
```

Put HTTPS in front (Caddy/nginx). See `scripts/deploy/`.

## Joining a shared pool (federation)

Only with operators you trust:

```bash
export ROULETTE_FEDERATION_TOKEN='shared-secret-among-ops'
export ROULETTE_PUBLIC_BASE=https://your-hub.example.com
# Optional bootstrap peers (require restart to change):
export ROULETTE_FEDERATION_PEERS=https://other.example.com
```

**Live claim peers (no restart):** after both hubs share the same token and
public bases, operators can add/remove HTTPS claim peers in **Admin → Mesh**
(`POST /v1/admin/federation_peers` → `data/federation_peers.json`).  
Env peers and file peers are merged. Outbound claims need **token + public_base + at least one peer**.

Protocol: [`INTEROP.md`](INTEROP.md).  
Local two-hub smoke test: `./scripts/run-federated-pair.sh`.  
Operator checklist (webhooks, analytics, deploy): [`OPS.md`](OPS.md).

Helpers **announce** via `/v1/seeder/request` but are **not auto-joined** (by design).

## Network helper

`ui/download/rulet-helper*.sh|ps1` runs a local bridge + public tunnel and syncs the **full chat UI** so people can open *your* tunnel URL and match **on your hub** even if another brand site is offline.

That is an **island** (or a federation peer if operators link you). It does not grant admin of `ruletka.vip`.

## What is still centralized (honest)

- Whoever runs a hub sees **signaling + chat text** for users on that hub.  
- TURN operators (if used) can relay **encrypted** media paths.  
- Default homepage still advertises the seed hub.  
- True matchmaking without *any* server is the Freenet research path (`docs/LOBBY_DESIGN.md`), not the default product.

## Roadmap toward more decentralization

1. Multi-hub client failover + public directory ← **this doc / current work**  
2. Signed hub keys (pin trust) instead of only shared tokens  
3. Gossip directory among federated peers  
4. Optional Freenet / Nostr signaling control plane  
5. Reproducible builds + signed helper releases  
