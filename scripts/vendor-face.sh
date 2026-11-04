#!/usr/bin/env bash
# Fetch the on-device face detector (face check before matching) into
# ui/vendor/face (same-origin copies; no third-party CDN at runtime).
# tfjs itself is shared with the NSFW filter: ui/vendor/nsfw/tfjs-4.22.0
# (scripts/vendor-nsfw.sh).
#
# Pinned versions + sha256 so a re-run can never pull a different file.
#   @tensorflow-models/blazeface 0.1.0 (UMD; uses window.tf)
#   model: BlazeFace short-range 128px graph model, TF Hub
#   tensorflow/tfjs-model/blazeface/1/default/1 (now served via Kaggle;
#   tfhub.dev redirects, curl -L follows). ~400 KB weights.
#
# Usage: ./scripts/vendor-face.sh   (re-run is a no-op when hashes match)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ui/vendor/face"
NPM=https://cdn.jsdelivr.net/npm
HUB="https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1"

# dest|url|sha256
FILES=(
  "blazeface-0.1.0/blazeface.min.js|$NPM/@tensorflow-models/blazeface@0.1.0/dist/blazeface.min.umd.js|e597d1f48a738cd68e1f35dfffe50094dc80d9d5c71ea6e1a095047128a598eb"
  "model/blazeface-1/model.json|$HUB/model.json?tfjs-format=file|7b6bb6f35e5a7899232de51dda8bf514ef9664ca7ec58388c9fecc088c883b58"
  "model/blazeface-1/group1-shard1of1.bin|$HUB/group1-shard1of1.bin?tfjs-format=file|60b481ab6c19352673cdb21e02e639f90883db1393ac52d07c7ea4e1e11cb2cd"
)

for row in "${FILES[@]}"; do
  IFS='|' read -r dest url sum <<<"$row"
  path="$OUT/$dest"
  if [[ -f "$path" ]] && echo "$sum  $path" | sha256sum -c --quiet - 2>/dev/null; then
    echo "ok   $dest"
    continue
  fi
  mkdir -p "$(dirname "$path")"
  tmp="$(mktemp)"
  curl -fsSL "$url" -o "$tmp"
  if ! echo "$sum  $tmp" | sha256sum -c --quiet -; then
    rm -f "$tmp"
    echo "sha256 mismatch: $url" >&2
    exit 1
  fi
  mv "$tmp" "$path"
  chmod a+r "$path"
  echo "got  $dest"
done
