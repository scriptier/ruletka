# Helper downloads

Shell/PowerShell helpers (`rulet-helper*`) live in this folder and are part of the source tree.

**Prebuilt `roulette-bridge-*` binaries are not committed** (see root `.gitignore`).  
Build them yourself or attach them to GitHub Releases:

```bash
# Linux (native)
cargo build -p freenet-roulette-bridge --release
cp target/release/roulette-bridge ui/download/roulette-bridge-linux-amd64

# Windows (example: cargo-zigbuild)
cargo zigbuild -p freenet-roulette-bridge --release --target x86_64-pc-windows-gnu
```

Production deploy (`scripts/deploy/push.sh`) stages whatever binaries are present into `/download/` on the server.
