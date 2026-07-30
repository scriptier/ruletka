# Contributing

Thanks for helping make stranger video chat more open and decentralized.

## Project layout

| Path | Role |
|------|------|
| `bridge/` | Match + WebSocket signaling + federation (`roulette-bridge`) |
| `ui/` | Homepage, live chat, helpers scripts |
| `docs/` | Architecture, federation, decentralization |
| `common/`, `contracts/`, `agent/` | Freenet research path (optional) |

## Dev loop

```bash
# Tests
cargo test

# Local product path
./scripts/run-bridge.sh
# → http://127.0.0.1:8790/live.html

# Two-hub federation demo
./scripts/run-federated-pair.sh
```

UI is static files served by the bridge. Hard-refresh or bump `?v=` on script tags when testing cache.

## Guidelines

1. **Media stays P2P** — do not pipe video frames through the bridge.
2. **No fake anonymity claims** — partners can record; identity is device-local unless you design otherwise.
3. **Federation is opt-in and allowlisted** — random helpers must not gain control of another hub.
4. Prefer small, reviewable PRs. Include EN + RU strings when adding user-facing text (`ui/i18n.js`).
5. Do not commit secrets, `data/*.env`, or prebuilt large binaries.

## Code of collaboration

Be respectful in issues and PRs. This is 18+ video chat software — treat safety features (block, report, blur, NSFW opt-in) as first-class.

## License

Contributions are accepted under **LGPL-2.1-only** (see `LICENSE` and `Cargo.toml`).
