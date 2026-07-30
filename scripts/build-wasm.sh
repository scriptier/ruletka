#!/usr/bin/env bash
# Build Freenet-ready WASM contracts (release + freenet-main-contract).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source "$HOME/.cargo/env" 2>/dev/null || true

rustup target add wasm32-unknown-unknown >/dev/null

echo "==> lobby WASM"
cargo build -p freenet-roulette-lobby --release \
  --target wasm32-unknown-unknown --features freenet-main-contract

echo "==> session WASM"
cargo build -p freenet-roulette-session --release \
  --target wasm32-unknown-unknown --features freenet-main-contract

OUT="$ROOT/target/wasm32-unknown-unknown/release"
ls -la "$OUT"/freenet_roulette_lobby.wasm "$OUT"/freenet_roulette_session.wasm
echo "OK"
