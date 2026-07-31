# ruletka — open peer-to-peer video roulette

**Open source** stranger (and friends) video chat.

- **Media is always WebRTC peer-to-peer** (not uploaded to a media server).
- **Matchmaking** runs on a small **hub** (`roulette-bridge`) — *anyone* can run one.
- **https://ruletka.vip** is a public **seed hub**, not the only network.
- Multi-hub **directory + client failover** so one site outage does not end the protocol.
- License: **LGPL-2.1-only** (see [`LICENSE`](LICENSE)).

| Docs | |
|------|--|
| Architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Decentralization | [`docs/DECENTRALIZATION.md`](docs/DECENTRALIZATION.md) |
| Federation | [`docs/INTEROP.md`](docs/INTEROP.md) |
| Operator ops | [`docs/OPS.md`](docs/OPS.md) |
| Security | [`SECURITY.md`](SECURITY.md) |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Status

| Piece | Status |
|-------|--------|
| Simple match bridge | `bridge/` — default product path |
| Live UI (EN/RU) | `ui/live.html` |
| Public hub directory | `ui/hubs.json` + `GET /v1/directory` |
| Client multi-hub failover | `ui/hubs.js` |
| Network helpers (Win/Mac/Linux) | `ui/download/rulet-helper*` — full island hub |
| Federation between operators | `nextface-fed/1` allowlisted peers |
| Freenet contracts (research) | `contracts/`, `agent/` |

## Quick start

```bash
# Tests
cargo test

# Run a hub locally
./scripts/run-bridge.sh
# → http://127.0.0.1:8790/          homepage
# → http://127.0.0.1:8790/live.html chat
```

Two browser tabs → Next on both → match. Video stays P2P.

### Environment

See [`.env.example`](.env.example):

```bash
export ROULETTE_PUBLIC_BASE=https://your-hub.example.com
export ROULETTE_DIRECTORY_HUBS=https://ruletka.vip,https://friend.example.com
# optional shared stranger pool with trusted ops only:
# export ROULETTE_FEDERATION_TOKEN=…
# export ROULETTE_FEDERATION_PEERS=https://other.example.com
```

### Federation demo (two hubs)

```bash
./scripts/run-federated-pair.sh
```

### Deploy

```bash
./scripts/deploy/push.sh   # needs SSH + droplet setup; see scripts/deploy/README.md
```

## Open source & brand

- **Software** is free under LGPL-2.1-only — run forks, private hubs, community meshes.
- **Brand** “ruletka.vip” and production secrets are separate; do not imply you operate the seed site without permission.
- Prebuilt helper binaries are **not** in git (build or attach to releases). Scripts live under `ui/download/`.

## Publishing / clone

Public repository (intended): **https://github.com/scriptier/ruletka**

```bash
git clone https://github.com/scriptier/ruletka.git
cd ruletka
cargo build -p freenet-roulette-bridge --release
./scripts/run-bridge.sh
```

Maintainers (push):

```bash
# SSH key must be on the GitHub account (scriptier)
export GIT_SSH_COMMAND='ssh -i ~/.ssh/github_ed25519 -o IdentitiesOnly=yes'
gh auth login   # once
gh repo create scriptier/ruletka --public --source=. --remote=origin --push
```

CI: `.github/workflows/ci.yml` runs `cargo test` + UI sanity on push.

## Honest limits

- A hub still sees **signaling + chat text** for its users.
- Partners can **record** video on their device.
- Full matchmaking with **zero** servers is the Freenet research path, not the default.
