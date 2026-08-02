# ruletka — open peer-to-peer video roulette

[![CI](https://github.com/scriptier/ruletka/actions/workflows/ci.yml/badge.svg)](https://github.com/scriptier/ruletka/actions/workflows/ci.yml)
[![License: LGPL-2.1-only](https://img.shields.io/badge/License-LGPL%202.1--only-blue.svg)](LICENSE)

**Open source** stranger (and friends) video chat.

- **Media is always WebRTC peer-to-peer** (not uploaded to a media server).
- **Matchmaking** runs on a small **hub** (`roulette-bridge`) — *anyone* can run one.
- **https://ruletka.vip** is a public **seed hub**, not the only network.
- Multi-hub **directory + client failover** so one site outage does not end the protocol.
- License: **LGPL-2.1-only** (see [`LICENSE`](LICENSE)).

| Docs | |
|------|--|
| **Self-host (Docker / VPS)** | [`docs/SELF_HOST.md`](docs/SELF_HOST.md) |
| Island helpers (PC double-click) | [`docs/HELPERS.md`](docs/HELPERS.md) |
| Mobile App Store / Play | [`docs/MOBILE.md`](docs/MOBILE.md) |
| Signaling protocol | [`docs/PROTOCOL.md`](docs/PROTOCOL.md) |
| Hub directory policy | [`docs/HUB_DIRECTORY.md`](docs/HUB_DIRECTORY.md) |
| Architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Decentralization | [`docs/DECENTRALIZATION.md`](docs/DECENTRALIZATION.md) |
| Federation | [`docs/INTEROP.md`](docs/INTEROP.md) |
| Operator ops | [`docs/OPS.md`](docs/OPS.md) |
| Security | [`SECURITY.md`](SECURITY.md) |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Code of Conduct | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) |

## Status

| Piece | Status |
|-------|--------|
| Simple match bridge | `bridge/` — default product path |
| Live UI (multi-language packs) | `ui/live.html`, `ui/i18n/` |
| Safety / community | `ui/safety.html`, `ui/legal/` |
| Public hub directory | `ui/hubs.json` + `GET /v1/directory` |
| Client multi-hub failover | `ui/hubs.js` |
| Network helpers (Win/Mac/Linux) | `ui/download/rulet-helper*` — full island hub |
| Federation between operators | `nextface-fed/1` allowlisted peers |
| Docker self-host | `Dockerfile` + `docker-compose.yml` |
| Island helpers (double-click) | `ui/download/ruletka-helper-*.zip` — see `/contribute.html` |
| Mobile (Expo / stores) | `mobile/` — see [`docs/MOBILE.md`](docs/MOBILE.md) |
| Freenet contracts (research) | `contracts/`, `agent/` |

## Quick start

### Docker (recommended for first try)

```bash
git clone https://github.com/scriptier/ruletka.git
cd ruletka
docker compose up --build
# → http://127.0.0.1:8790/live.html  (two tabs to match)
```

### Cargo

```bash
cargo test --workspace --exclude freenet-roulette-lobby --exclude freenet-roulette-session
./scripts/run-bridge.sh
# → http://127.0.0.1:8790/          homepage
# → http://127.0.0.1:8790/live.html chat
```

Two browser tabs → Start / Next on both → match. Video stays P2P.

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

### Production deploy (operators)

Generic self-host: [`docs/SELF_HOST.md`](docs/SELF_HOST.md).  
Seed-site automation: `./scripts/deploy/push.sh` (see `scripts/deploy/README.md`) — never commits secrets; only syncs `bin/`, `ui/`, `deploy/`.

## Open source & brand

- **Software** is free under LGPL-2.1-only — run forks, private hubs, community meshes.
- **Brand** “ruletka.vip” and production secrets are separate; do not imply you operate the seed site without permission.
- Prebuilt helper binaries are **not** in git (build or attach to GitHub Releases). Scripts live under `ui/download/`.
- Machine-readable seed metadata: [`ui/source.json`](ui/source.json) (also at `https://ruletka.vip/source.json`).

## Clone

```bash
git clone https://github.com/scriptier/ruletka.git
cd ruletka
docker compose up --build
# or: cargo build -p freenet-roulette-bridge --release && ./scripts/run-bridge.sh
```

CI: `.github/workflows/ci.yml` runs `cargo test` + UI sanity on push.

## Honest limits

- A hub still sees **signaling + chat text** for its users.
- Partners can **record** video on their device.
- Full matchmaking with **zero** servers is the Freenet research path, not the default.
- Stars / friends are **per hub** — not a global account system.
