#!/usr/bin/env bash
# Fetch the on-device NSFW filter files into ui/vendor/nsfw (same-origin copies).
# live.js loads these first and falls back to jsDelivr only if they fail.
#
# Pinned versions + sha256 so a re-run can never pull a different file.
#   tfjs 4.22.0 · tfjs-backend-wasm 4.22.0 · nsfwjs 2.4.2
#   model: nsfwjs quant MobileNet v2 (224px). nsfwjs 2.4.2 defaulted to
#   d1zv2aa70wpiur.cloudfront.net/tfjs_quant_nsfw_mobilenet/, which no longer
#   resolves (checked 2026-11-03). Same bytes live in the nsfwjs repo at tag
#   v2.4.1 example/nsfw_demo/public/quant_nsfw_mobilenet/ and on master
#   models/mobilenet_v2/ (identical sha256).
#
# Usage: ./scripts/vendor-nsfw.sh   (re-run is a no-op when hashes match)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ui/vendor/nsfw"
NPM=https://cdn.jsdelivr.net/npm
GH=https://cdn.jsdelivr.net/gh/infinitered/nsfwjs@v2.4.1/example/nsfw_demo/public/quant_nsfw_mobilenet

# dest|url|sha256
FILES=(
  "tfjs-4.22.0/tf.min.js|$NPM/@tensorflow/tfjs@4.22.0/dist/tf.min.js|300dfae273d20b4046f46a06d735688f03675a807561e9bcb5f664eb2f3d2831"
  "tfjs-backend-wasm-4.22.0/tf-backend-wasm.min.js|$NPM/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tf-backend-wasm.min.js|691bbec0ef8b5a7f17f212e9c5d85832030f90d030b46e99acb4dea1fb16f009"
  "tfjs-backend-wasm-4.22.0/tfjs-backend-wasm.wasm|$NPM/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tfjs-backend-wasm.wasm|70a5d516060464e5269f01c74bac1772d6b8ab6cb612acf16b5cdaf61f78d892"
  "tfjs-backend-wasm-4.22.0/tfjs-backend-wasm-simd.wasm|$NPM/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tfjs-backend-wasm-simd.wasm|77ebb28a6d34f371dbbf2086b7f2de8994acd8ea5a3cf1fa24d2c26c840cac7b"
  "tfjs-backend-wasm-4.22.0/tfjs-backend-wasm-threaded-simd.wasm|$NPM/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tfjs-backend-wasm-threaded-simd.wasm|c052228d4bef185c27bbe59a9e029570c78bbb9f08b3cb46b597851650373de2"
  "nsfwjs-2.4.2/nsfwjs.min.js|$NPM/nsfwjs@2.4.2/dist/nsfwjs.min.js|ed166292880456978d31f36cbe5586b7442550cee60da4ce36b567bed4ababc0"
  "model/quant_nsfw_mobilenet-v2.4.1/model.json|$GH/model.json|11846416217e68bf1eb7b0e651bcfd305973566453c63275bbd16766ab089979"
  "model/quant_nsfw_mobilenet-v2.4.1/group1-shard1of1|$GH/group1-shard1of1|8e7dddbb16acacc1bf1601b1b8a761e730ff934b7f2d7771312b2f000e5f5f13"
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
