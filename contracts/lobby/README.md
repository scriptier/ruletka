# Lobby contract

Freenet `ContractInterface` over `LobbyState` (CBOR). Merges are commutative;
offers with ed25519 signatures are verified on update.

## Build WASM

```bash
cargo build -p freenet-roulette-lobby --release \
  --target wasm32-unknown-unknown --features freenet-main-contract
```

Output: `target/wasm32-unknown-unknown/release/freenet_roulette_lobby.wasm`

## Publish (with local Freenet node)

```bash
# empty initial state
fdev -p 7509 publish \
  --code target/wasm32-unknown-unknown/release/freenet_roulette_lobby.wasm \
  contract --state /dev/null
```

See [Freenet tutorial](https://freenet.org/build/manual/tutorial/).
