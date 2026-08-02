#!/usr/bin/env bash
# Build + upload + install to DigitalOcean droplet.
# Usage:
#   ./scripts/deploy/push.sh
#   HOST=root@209.38.204.153 ./scripts/deploy/push.sh
#   SSH_KEY=~/.ssh/ruletka_ed25519 ./scripts/deploy/push.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
source "$HOME/.cargo/env" 2>/dev/null || true

HOST="${HOST:-root@209.38.204.153}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
SCP=(scp -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

echo "Building release binary…"
cargo build -p freenet-roulette-bridge --release

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE"/{bin,ui,data,deploy}

cp -a target/release/roulette-bridge "$STAGE/bin/"
# UI only (not whole repo)
rsync -a --delete \
  --exclude '*.map' \
  --exclude 'brand/loading-screen.full.mp4' \
  --exclude 'brand/og-1200.prev.jpg' \
  ui/ "$STAGE/ui/"
# Minify heavy JS/CSS before upload
if [[ -x "$ROOT/scripts/deploy/optimize-ui.sh" ]]; then
  bash "$ROOT/scripts/deploy/optimize-ui.sh" "$STAGE/ui"
elif [[ -f "$ROOT/scripts/deploy/optimize-ui.sh" ]]; then
  bash "$ROOT/scripts/deploy/optimize-ui.sh" "$STAGE/ui"
fi
# Public helper downloads (Linux / Windows / macOS)
mkdir -p "$STAGE/ui/download"
cp -a target/release/roulette-bridge "$STAGE/ui/download/roulette-bridge-linux-amd64"
chmod +x "$STAGE/ui/download/roulette-bridge-linux-amd64"
# Prefer prebuilt multi-arch artifacts from ui/download if present (cross-compiled)
for f in \
  roulette-bridge-windows-amd64.exe \
  roulette-bridge-macos-arm64 \
  roulette-bridge-macos-amd64 \
  rulet-helper.sh \
  rulet-helper-mac.sh \
  rulet-helper-mac.command \
  rulet-helper.ps1 \
  rulet-helper.bat \
  rulet-helper.desktop \
  SHA256SUMS \
  SHA256SUMS.asc \
  RELEASE.txt \
  README.md
do
  if [[ -f "ui/download/$f" ]]; then
    cp -a "ui/download/$f" "$STAGE/ui/download/"
  fi
done
# If Windows/Mac builds exist in target/, refresh them into the stage
[[ -f target/x86_64-pc-windows-gnu/release/roulette-bridge.exe ]] && \
  cp -a target/x86_64-pc-windows-gnu/release/roulette-bridge.exe \
    "$STAGE/ui/download/roulette-bridge-windows-amd64.exe"
[[ -f target/aarch64-apple-darwin/release/roulette-bridge ]] && \
  cp -a target/aarch64-apple-darwin/release/roulette-bridge \
    "$STAGE/ui/download/roulette-bridge-macos-arm64"
[[ -f target/x86_64-apple-darwin/release/roulette-bridge ]] && \
  cp -a target/x86_64-apple-darwin/release/roulette-bridge \
    "$STAGE/ui/download/roulette-bridge-macos-amd64"
chmod +x "$STAGE/ui/download/"roulette-bridge-* \
  "$STAGE/ui/download/"rulet-helper*.sh \
  "$STAGE/ui/download/"rulet-helper*.command 2>/dev/null || true
# Always recompute checksums for what we actually ship (linux binary is freshly built)
(
  cd "$STAGE/ui/download"
  files=()
  for f in \
    roulette-bridge-linux-amd64 \
    roulette-bridge-windows-amd64.exe \
    roulette-bridge-macos-arm64 \
    roulette-bridge-macos-amd64 \
    rulet-helper.sh \
    rulet-helper-mac.sh \
    rulet-helper-mac.command \
    rulet-helper.ps1 \
    rulet-helper.bat \
    rulet-helper.desktop
  do
    [[ -f "$f" ]] && files+=("$f")
  done
  if [[ ${#files[@]} -gt 0 ]]; then
    sha256sum "${files[@]}" > SHA256SUMS
    echo "Helper SHA256SUMS:"
    cat SHA256SUMS
  fi
)
cp -a scripts/deploy/Caddyfile \
  scripts/deploy/roulette-bridge.service \
  scripts/deploy/install-on-server.sh \
  scripts/deploy/coturn.conf \
  scripts/deploy/setup-turn.sh \
  scripts/deploy/backup-ruletka-data.sh \
  "$STAGE/deploy/"
chmod +x "$STAGE/bin/roulette-bridge" \
  "$STAGE/deploy/install-on-server.sh" \
  "$STAGE/deploy/setup-turn.sh" \
  "$STAGE/deploy/backup-ruletka-data.sh"
# NEVER put friends/ledger/secrets in STAGE — production data must survive deploys.
# (Older push.sh rsync --delete'd the whole /opt/ruletka tree and wiped backups + env.)

echo "Testing SSH to $HOST …"
if ! "${SSH[@]}" "$HOST" 'echo ssh_ok'; then
  cat <<EOF

SSH failed. Add this public key to the droplet, then re-run:

  $(cat "$SSH_KEY.pub")

DigitalOcean → Droplets → your droplet → Access → Launch Droplet Console
  or Settings → add SSH key, then:

  # as root in web console:
  mkdir -p /root/.ssh && chmod 700 /root/.ssh
  echo '$(cat "$SSH_KEY.pub")' >> /root/.ssh/authorized_keys
  chmod 600 /root/.ssh/authorized_keys

EOF
  exit 1
fi

echo "Uploading to $HOST:/opt/ruletka (bin/ui/deploy only — data & backups preserved)…"
"${SSH[@]}" "$HOST" 'mkdir -p /opt/ruletka/{bin,ui,deploy,data,backups} && apt-get update -qq && apt-get install -y -qq rsync >/dev/null || true'
# Sync only code/UI/deploy. --delete is safe inside these dirs; never touch data/ or backups/.
rsync -az --delete -e "$RSYNC_SSH" "$STAGE/bin/"    "$HOST:/opt/ruletka/bin/"
rsync -az --delete -e "$RSYNC_SSH" "$STAGE/ui/"     "$HOST:/opt/ruletka/ui/"
rsync -az --delete -e "$RSYNC_SSH" "$STAGE/deploy/" "$HOST:/opt/ruletka/deploy/"
# Seed empty friends.json ONLY if production has none (first install).
"${SSH[@]}" "$HOST" 'if [[ ! -f /opt/ruletka/data/friends.json ]]; then echo "{}" >/opt/ruletka/data/friends.json; chown ruletka:ruletka /opt/ruletka/data/friends.json 2>/dev/null || true; echo "seeded empty friends.json"; fi'

echo "Running install on server…"
"${SSH[@]}" "$HOST" 'bash /opt/ruletka/deploy/install-on-server.sh'

echo
echo "Done. Open:"
echo "  https://ruletka.vip/"
echo "  https://ruletka.vip/live.html"
echo
"${SSH[@]}" "$HOST" 'curl -sS http://127.0.0.1:8790/health; echo; curl -sS -o /dev/null -w "https_home:%{http_code}\n" --connect-timeout 15 https://ruletka.vip/ || true'
