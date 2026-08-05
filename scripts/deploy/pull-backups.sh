#!/usr/bin/env bash
# Pull ruletka data backups from the production droplet to this machine (off-box copy).
#
# Usage:
#   ./scripts/deploy/pull-backups.sh
#   HOST=deploy@209.38.204.153 DEST=~/ruletka-backups ./scripts/deploy/pull-backups.sh
#
# Requires: SSH key (default ~/.ssh/ruletka_ed25519), rsync
set -euo pipefail

HOST="${HOST:-deploy@209.38.204.153}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
DEST="${DEST:-$HOME/ruletka-backups}"
REMOTE_DIR="${REMOTE_DIR:-/opt/ruletka/backups/}"

SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes)
RSYNC_SSH="ssh -i $SSH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o BatchMode=yes"

mkdir -p "$DEST"
echo "Pulling $HOST:$REMOTE_DIR → $DEST"
rsync -avz -e "$RSYNC_SSH" \
  "$HOST:$REMOTE_DIR" \
  "$DEST/"
chmod 700 "$DEST" 2>/dev/null || true
find "$DEST" -type f -name '*.tgz' -exec chmod 600 {} \; 2>/dev/null || true

echo "Latest:"
ls -lht "$DEST"/ruletka-data-*.tgz 2>/dev/null | head -5 || ls -lht "$DEST" | head -8
echo "OK — keep this directory off the droplet (this is your off-box copy)."
