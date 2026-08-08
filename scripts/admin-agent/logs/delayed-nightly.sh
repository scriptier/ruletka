#!/usr/bin/env bash
set -euo pipefail
ROOT=/home/drakosik/freenet-roulette
cd "$ROOT"
# wait until argument seconds
sleep "$1"
exec ./scripts/admin-agent/nightly.sh >> scripts/admin-agent/logs/cron.log 2>&1
