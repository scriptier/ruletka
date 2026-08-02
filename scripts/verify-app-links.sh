#!/usr/bin/env bash
# Check public Universal Links / App Links endpoints.
# Usage: ./scripts/verify-app-links.sh [https://ruletka.vip]
set -euo pipefail
BASE="${1:-https://ruletka.vip}"
BASE="${BASE%/}"

check() {
  local path="$1"
  local url="$BASE$path"
  local code ct body
  code=$(curl -sS -o /tmp/al-body -w "%{http_code}" "$url")
  ct=$(curl -sS -o /dev/null -w "%{content_type}" "$url")
  body=$(head -c 200 /tmp/al-body | tr '\n' ' ')
  echo "$code  $ct  $path"
  echo "     $body"
  if [[ "$code" != "200" ]]; then
    echo "FAIL: expected 200" >&2
    exit 1
  fi
  if [[ "$ct" != *json* ]]; then
    echo "WARN: content-type should be application/json (got $ct)" >&2
  fi
}

echo "Base: $BASE"
check "/.well-known/apple-app-site-association"
check "/apple-app-site-association"
check "/.well-known/assetlinks.json"
echo "OK — endpoints live (fill ROULETTE_IOS_TEAM_ID / ROULETTE_ANDROID_SHA256 for real app claims)"
