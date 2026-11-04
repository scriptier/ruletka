#!/usr/bin/env bash
# Fetch the on-device genital detector (auto-ban signal) into ui/vendor/genital
# (same-origin copies; no third-party CDN at runtime).
#
# Pinned versions + sha256 so a re-run can never pull a different file.
#   onnxruntime-web 1.22.0 (MIT): wasm-only bundle, SIMD wasm (11.2 MB raw,
#     ~2.9 MB gzip / ~1.8 MB brotli). No WebGPU/JSEP build (smaller).
#   NudeNet 3.4 detector "320n" (YOLOv8n, 320x320, 12.2 MB fp32 ONNX).
#     License: AGPL-3.0 (repo LICENSE + ONNX metadata "Ultralytics AGPL-3.0").
#     GitHub release downloads now redirect to a login page, so the bytes are
#     taken from the PyPI wheel nudenet==3.4.2 (sha256-pinned below), which
#     ships the same 320n.onnx. The AGPL text from the wheel is copied beside it.
#
# Usage: ./scripts/vendor-genital.sh   (re-run is a no-op when hashes match)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/ui/vendor/genital"
NPM=https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist
WHEEL_URL=https://files.pythonhosted.org/packages/1c/ee/1aa02d44ba958cc77e16ff1e41a0aac5e721037db7bf62b9c9d124917f87/nudenet-3.4.2-py3-none-any.whl
WHEEL_SHA=5937dbd84e5d8e5de038f08ffea5a1bb50a08475776bf2b4795914ce0eaf0331

# dest|url|sha256  (url "wheel:<member>" = file inside the pinned wheel)
FILES=(
  "ort-1.22.0/ort.wasm.min.js|$NPM/ort.wasm.min.js|65e09376df69107e881b5c34d2d37aed333a366b6d941073ec518168e269b87d"
  "ort-1.22.0/ort-wasm-simd-threaded.mjs|$NPM/ort-wasm-simd-threaded.mjs|30dd851d9c00622940500f71ddd2ff8820c5cb65270816080175b958705385a8"
  "ort-1.22.0/ort-wasm-simd-threaded.wasm|$NPM/ort-wasm-simd-threaded.wasm|71aef04959c5c1b6de461b6538e2058e306610034a85aad2742d0c7fd4533fe4"
  "ort-1.22.0/LICENSE|https://cdn.jsdelivr.net/gh/microsoft/onnxruntime@v1.22.0/LICENSE|2f07c72751aed99790b8a4869cf2311df85a860b22ded05fa22803587a48922c"
  "model/nudenet-320n-3.4.2/320n.onnx|wheel:nudenet/320n.onnx|c15d8273adad2d0a92f014cc69ab2d6c311a06777a55545f2c4eb46f51911f0f"
  "model/nudenet-320n-3.4.2/LICENSE|wheel:nudenet-3.4.2.dist-info/LICENSE|8486a10c4393cee1c25392769ddd3b2d6c242d6ec7928e1414efff7dfb2f07ef"
)

WHEEL=""
cleanup() { if [[ -n "$WHEEL" ]]; then rm -f "$WHEEL"; fi; }
trap cleanup EXIT
get_wheel() {
  [[ -n "$WHEEL" ]] && return 0
  WHEEL="$(mktemp)"
  curl -fsSL "$WHEEL_URL" -o "$WHEEL"
  if ! echo "$WHEEL_SHA  $WHEEL" | sha256sum -c --quiet -; then
    echo "sha256 mismatch: $WHEEL_URL" >&2
    exit 1
  fi
}

for row in "${FILES[@]}"; do
  IFS='|' read -r dest url sum <<<"$row"
  path="$OUT/$dest"
  if [[ -f "$path" ]] && echo "$sum  $path" | sha256sum -c --quiet - 2>/dev/null; then
    echo "ok   $dest"
    continue
  fi
  mkdir -p "$(dirname "$path")"
  tmp="$(mktemp)"
  if [[ "$url" == wheel:* ]]; then
    get_wheel
    python3 - "$WHEEL" "${url#wheel:}" "$tmp" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z, open(sys.argv[3], "wb") as f:
    f.write(z.read(sys.argv[2]))
PY
  else
    curl -fsSL "$url" -o "$tmp"
  fi
  if ! echo "$sum  $tmp" | sha256sum -c --quiet -; then
    rm -f "$tmp"
    echo "sha256 mismatch: $url" >&2
    exit 1
  fi
  mv "$tmp" "$path"
  chmod a+r "$path"
  echo "got  $dest"
done
