#!/usr/bin/env bash
# Herdr layout: Grok MAIN (left) + Claude SECONDARY (right) for freenet-roulette.
set -euo pipefail
export PATH="${HOME}/.local/bin:${PATH}"
ROOT="${ROOT:-$HOME/freenet-roulette}"
LABEL="${HERD_WS_LABEL:-ruletka (grok main)}"

need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }
need herdr
need grok
need claude

# Integrations (idempotent)
herdr integration install grok >/dev/null 2>&1 || true
herdr integration install claude >/dev/null 2>&1 || true

# Ensure server
herdr status server >/dev/null 2>&1 || true

echo "Creating workspace: $LABEL"
WS_JSON=$(herdr workspace create --cwd "$ROOT" --label "$LABEL" --focus)
MAIN=$(echo "$WS_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["root_pane"]["pane_id"])')
echo "main pane=$MAIN"

herdr pane rename "$MAIN" "grok-main" >/dev/null

echo "Starting Grok (main)…"
# Long timeout — Grok TUI can be slow to report idle
if ! herdr agent start main --kind grok --pane "$MAIN" --timeout 120000 -- --cwd "$ROOT"; then
  echo "agent start timed out — launching grok via pane run"
  herdr pane run "$MAIN" "grok --cwd $ROOT" || herdr pane send-text "$MAIN" "grok --cwd $ROOT" 
  herdr pane send-keys "$MAIN" enter || true
fi

echo "Splitting for Claude (secondary)…"
SPLIT=$(herdr pane split "$MAIN" --direction right --ratio 0.62 --cwd "$ROOT" --no-focus)
SEC=$(echo "$SPLIT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["pane"]["pane_id"])')
herdr pane rename "$SEC" "claude-secondary" >/dev/null
echo "secondary pane=$SEC"

echo "Starting Claude (secondary)…"
herdr agent start secondary --kind claude --pane "$SEC" --timeout 120000 || {
  herdr pane run "$SEC" "claude" || true
}

# Give Grok more width
herdr pane resize --direction right --amount 0.05 --pane "$MAIN" >/dev/null 2>&1 || true
herdr pane focus --direction left --pane "$SEC" >/dev/null 2>&1 || true
herdr workspace focus "$(echo "$WS_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["workspace"]["workspace_id"])')" >/dev/null

echo ""
echo "Layout ready. Open UI:  herdr"
echo "  LEFT  = Grok  (main / director)"
echo "  RIGHT = Claude (secondary / worker)"
echo ""
herdr agent list
