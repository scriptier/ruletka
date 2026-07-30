#!/usr/bin/env bash
# Start Freenet in local (offline) mode for contract development.
set -euo pipefail
PORT="${WS_API_PORT:-7509}"
echo "Starting freenet local on ws port $PORT (Ctrl+C to stop)"
exec freenet local --ws-api-port "$PORT"
