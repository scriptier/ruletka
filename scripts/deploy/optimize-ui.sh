#!/usr/bin/env bash
# Minify heavy UI assets in-place (for deploy staging dir).
# Usage: ./scripts/deploy/optimize-ui.sh /path/to/ui
set -euo pipefail

UI="${1:-}"
if [[ -z "$UI" || ! -d "$UI" ]]; then
  echo "usage: $0 /path/to/ui" >&2
  exit 1
fi

have() { command -v "$1" >/dev/null 2>&1; }

minify_js() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local tmp
  tmp="$(mktemp)"
  if have terser; then
    if terser "$f" -c -m -o "$tmp" 2>/dev/null; then
      mv "$tmp" "$f"
      return 0
    fi
  fi
  if have npx; then
    if npx --yes esbuild "$f" --minify --outfile="$tmp" 2>/dev/null; then
      mv "$tmp" "$f"
      return 0
    fi
  fi
  rm -f "$tmp"
  echo "warn: no minifier for $f (left uncompressed)" >&2
}

minify_css() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local tmp
  tmp="$(mktemp)"
  if have npx; then
    if npx --yes esbuild "$f" --minify --outfile="$tmp" 2>/dev/null; then
      mv "$tmp" "$f"
      return 0
    fi
  fi
  # lightweight fallback: strip comments + collapse whitespace (safe enough for our CSS)
  if have python3; then
    python3 - "$f" "$tmp" <<'PY'
import re, sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src, "r", encoding="utf-8", errors="replace").read()
text = re.sub(r"/\*[\s\S]*?\*/", "", text)
text = re.sub(r"\s+", " ", text)
text = re.sub(r"\s*([{}:;,])\s*", r"\1", text)
open(dst, "w", encoding="utf-8").write(text.strip() + "\n")
PY
    mv "$tmp" "$f"
    return 0
  fi
  rm -f "$tmp"
  echo "warn: no CSS minifier for $f" >&2
}

echo "Optimizing UI in $UI …"
before=$(du -sb "$UI" 2>/dev/null | awk '{print $1}')

# Heavy critical path
for f in live.js i18n.js webrtc.js hubs.js identity.js pwa-install.js analytics.js \
         live-window.js invite-copy.js brand.js qr.js qrcode-generator.js home.css live-stage.css style.css; do
  path="$UI/$f"
  if [[ -f "$path" ]]; then
    case "$f" in
      *.js) minify_js "$path" ;;
      *.css) minify_css "$path" ;;
    esac
  fi
done

# Drop oversized non-ship media if present
rm -f "$UI/brand/loading-screen.full.mp4" "$UI/brand/og-1200.prev.jpg" 2>/dev/null || true

# Bridge ServeDir needs world-readable files
find "$UI" -type f -exec chmod a+r {} \; 2>/dev/null || true
find "$UI" -type d -exec chmod a+rx {} \; 2>/dev/null || true

after=$(du -sb "$UI" 2>/dev/null | awk '{print $1}')
if [[ -n "${before:-}" && -n "${after:-}" ]]; then
  echo "UI bytes: $before → $after"
fi
echo "optimize-ui done."