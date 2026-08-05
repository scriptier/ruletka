#!/usr/bin/env bash
# Copy web i18n packs into mobile (run after editing ui/i18n/*.json)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/mobile/src/i18n/packs"
mkdir -p "$DEST"
for c in en ru de es fr pl pt tr uk zh cs bg sr ar; do
  cp "$ROOT/ui/i18n/$c.json" "$DEST/$c.json"
  echo "synced $c"
done
