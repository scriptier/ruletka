#!/usr/bin/env bash
# Build multi-platform helper binaries + SHA256SUMS (and optional GPG signatures).
# Usage:
#   ./scripts/build-helpers.sh           # checksum existing ui/download artifacts
#   ./scripts/build-helpers.sh --build   # also cargo build native linux release
#   SIGN=1 ./scripts/build-helpers.sh    # gpg --detach-sign SHA256SUMS if key available
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
source "$HOME/.cargo/env" 2>/dev/null || true

OUT="$ROOT/ui/download"
mkdir -p "$OUT"

BUILD=0
for a in "$@"; do
  case "$a" in
    --build) BUILD=1 ;;
  esac
done

if [[ "$BUILD" == "1" ]]; then
  echo "Building native release bridge…"
  cargo build -p freenet-roulette-bridge --release
  cp -a target/release/roulette-bridge "$OUT/roulette-bridge-linux-amd64"
  chmod +x "$OUT/roulette-bridge-linux-amd64"
  # Optional cross builds if toolchains present
  if command -v cargo-zigbuild >/dev/null 2>&1; then
    echo "Cross-building Windows (zigbuild)…"
    cargo zigbuild -p freenet-roulette-bridge --release --target x86_64-pc-windows-gnu || true
    [[ -f target/x86_64-pc-windows-gnu/release/roulette-bridge.exe ]] && \
      cp -a target/x86_64-pc-windows-gnu/release/roulette-bridge.exe \
        "$OUT/roulette-bridge-windows-amd64.exe"
  fi
  # macOS binaries only if already present from prior builds / CI
fi

echo "Writing SHA256SUMS…"
(
  cd "$OUT"
  # Stable ordered list of published artifacts
  files=()
  for f in \
    roulette-bridge-linux-amd64 \
    roulette-bridge-windows-amd64.exe \
    roulette-bridge-macos-arm64 \
    roulette-bridge-macos-amd64 \
    rulet-helper.sh \
    rulet-helper-mac.sh \
    rulet-helper.ps1
  do
    [[ -f "$f" ]] && files+=("$f")
  done
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No helper artifacts in $OUT" >&2
    exit 1
  fi
  sha256sum "${files[@]}" | tee SHA256SUMS
)

# Optional GPG detach-sign of the sums file (not Apple/Microsoft code-signing)
if [[ "${SIGN:-0}" == "1" ]] || [[ "${SIGN:-}" == "true" ]]; then
  if command -v gpg >/dev/null 2>&1; then
    echo "GPG-signing SHA256SUMS…"
    gpg --batch --yes --detach-sign --armor -o "$OUT/SHA256SUMS.asc" "$OUT/SHA256SUMS" \
      || echo "GPG sign failed (no secret key?) — SHA256SUMS still published"
  else
    echo "gpg not installed; skip signature"
  fi
fi

# Human-readable release notes stub
cat >"$OUT/RELEASE.txt" <<EOF
ruletka helper artifacts
Generated: $(date -u +%Y-%m-%dT%H:%MZ)
Host: $(uname -s)/$(uname -m)

Verify:
  cd ui/download
  sha256sum -c SHA256SUMS

Optional GPG:
  gpg --verify SHA256SUMS.asc SHA256SUMS

Note: Platform code-signing (Apple Developer / EV Authenticode) is separate
from these checksums. Until signed, macOS Gatekeeper / Windows SmartScreen
may warn on first run — use “Open Anyway” / “More info → Run anyway” if you
trust this build source.
EOF

echo ""
echo "Artifacts in $OUT:"
ls -lh "$OUT"/roulette-bridge-* "$OUT"/rulet-helper* "$OUT"/SHA256SUMS* "$OUT"/RELEASE.txt 2>/dev/null || true
echo "Done."
