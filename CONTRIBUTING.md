# Contributing

Thanks for helping make stranger video chat more open and decentralized.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: [SECURITY.md](SECURITY.md) (not public issues).

## Project layout

| Path | Role |
|------|------|
| `bridge/` | Match + WebSocket signaling + federation (`roulette-bridge`) |
| `ui/` | Homepage, live chat, helper downloads |
| `docs/` | Architecture, self-host, protocol, federation |
| `common/`, `contracts/`, `agent/` | Freenet research path (optional) |
| `Dockerfile`, `docker-compose.yml` | One-command local hub |
| `mobile/` | Expo / React Native store apps (see `docs/MOBILE.md`) |

## Dev loop

```bash
# Tests
cargo test --workspace --exclude freenet-roulette-lobby --exclude freenet-roulette-session

# Local hub (no Freenet)
./scripts/run-bridge.sh
# → http://127.0.0.1:8790/live.html

# Or Docker
docker compose up --build

# Two-hub federation demo
./scripts/run-federated-pair.sh
```

Open **two browser tabs** on live → Start on both → match. Hard-refresh or bump `?v=` on script tags when testing cache.

Self-host / VPS: [`docs/SELF_HOST.md`](docs/SELF_HOST.md). Wire protocol: [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## Guidelines

1. **Media stays P2P** — do not pipe video frames through the bridge.
2. **No fake anonymity claims** — partners can record; identity is device-local unless designed otherwise.
3. **Federation is opt-in and allowlisted** — random helpers must not control another hub.
4. Prefer small, reviewable PRs.
5. **User-facing strings:** add keys to `ui/i18n/en.json` and `ui/i18n/ru.json` first; backfill other packs under `ui/i18n/*.json` when you can. Keep placeholders (`{name}`, `{n}`, …) intact. Bump `?v=` in `ui/i18n.js` pack fetch when shipping string-only changes.
6. Do not commit secrets, `data/*.env`, star ledgers with real users, or large prebuilt binaries.
7. Treat safety features (block, report, blur, NSFW opt-in, 18+) as first-class.

## Good first contributions

- Self-host docs / Docker polish
- i18n polish (secondary languages)
- Issue templates / README clarity
- Protocol examples / alternative mini-client
- Accessibility on live chrome
- Tests for bridge protocol edge cases

## Hub directory

Request listing: [`docs/HUB_DIRECTORY.md`](docs/HUB_DIRECTORY.md).

## License

Contributions are accepted under **LGPL-2.1-only** (see `LICENSE` and `Cargo.toml`).
