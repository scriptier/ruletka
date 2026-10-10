#!/usr/bin/env bash
# SessionStart + PostCompact: write a tiny live card. Stdout is ignored by Grok.
set -euo pipefail

ROOT="${GROK_PROJECT_DIR:-${GROK_WORKSPACE_ROOT:-}}"
if [[ -z "$ROOT" && -f AGENTS.md ]]; then
  ROOT="$(pwd)"
elif [[ -z "$ROOT" ]]; then
  ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
fi
cd "$ROOT" 2>/dev/null || exit 0

# Stay inert outside this repo.
if [[ ! -f AGENTS.md || ! -d knowledge/specs ]]; then
  exit 0
fi

CARD="$ROOT/.grok/session-card.txt"

disk_apk="?"
if [[ -f mobile/app.json ]]; then
  disk_apk=$(python3 -c "
import json
d=json.load(open('mobile/app.json'))
e=d.get('expo') or d
v=e.get('version','?')
vc=(e.get('android') or {}).get('versionCode','?')
print(f'{v}-vc{vc}')
" 2>/dev/null || echo "?")
fi

pin_js="?"; pin_rtc="?"; pin_css="?"
if [[ -f ui/live.html ]]; then
  pin_js=$(grep -oE -m1 'live\.js\?v=[0-9]+' ui/live.html || true)
  pin_rtc=$(grep -oE -m1 'webrtc\.js\?v=[0-9]+' ui/live.html || true)
  pin_css=$(grep -oE -m1 'live-stage\.css\?v=[0-9]+' ui/live.html || true)
fi

specs="none"
if ls knowledge/specs/current-*.md >/dev/null 2>&1; then
  spec_n=$(ls -1 knowledge/specs/current-*.md | wc -l | tr -d '[:space:]')
  top=$(ls -1t knowledge/specs/current-*.md | head -n 5 | sed 's|.*/||' | tr '\n' ' ' | sed 's/[[:space:]]*$//')
  if [ "$spec_n" -gt 5 ]; then
    specs="$top (+$((spec_n - 5)) more — do not read all)"
  else
    specs="$top"
  fi
fi

last="(none)"
if [[ -f knowledge/wiki/log.md ]]; then
  last=$(grep -E -m1 '^## \[' knowledge/wiki/log.md | cut -c1-140)
  [[ -n "$last" ]] || last="(none)"
fi

dirty=0
head="unknown"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  dirty=$(git status --porcelain | wc -l | tr -d '[:space:]')
  head=$(git log -1 --oneline 2>/dev/null || echo unknown)
fi

umask 077
{
  echo "ruletka session card"
  echo "disk APK: $disk_apk  (installed may lag — do not invent)"
  echo "disk pins: ${pin_js:-?} · ${pin_rtc:-?} · ${pin_css:-?}"
  echo "picture: knowledge/wiki/now.md"
  echo "specs: $specs"
  echo "last wiki: $last"
  echo "dirty: $dirty"
  echo "HEAD: $head"
  echo "brief: now.md — not SMOKE-NEXT; one matching spec only"
  echo "never: pool>0 · push.sh · invent product.ok/MULTI_PASS · APK flood"
  echo "relayed same-LAN = designed FRA TURN (lock stays)"
} > "$CARD.tmp"
mv "$CARD.tmp" "$CARD"

# stdout ignored on SessionStart; keep a one-liner for /hooks logs
echo "ruletka card → .grok/session-card.txt (read now.md next)"
exit 0
