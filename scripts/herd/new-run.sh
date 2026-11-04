#!/usr/bin/env bash
# Create a new herd run under artifacts/herd/<run_id>/.
# Usage: ./scripts/herd/new-run.sh ["optional goal text"]
set -euo pipefail

# Ensure herd scripts are executable (idempotent)
HERD_BIN="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$HERD_BIN"/*.sh 2>/dev/null || true

# shellcheck source=lib.sh
source "$HERD_BIN/lib.sh"
herd_load

GOAL="${1:-}"
RUN_ID="$(herd_run_id_now)"
RUN_DIR="$HERD_DIR/$RUN_ID"
CREATED="$(herd_now)"

if [[ -d "$RUN_DIR" ]]; then
  # Extremely unlikely collision (same second); append pid
  RUN_ID="${RUN_ID}-$$"
  RUN_DIR="$HERD_DIR/$RUN_ID"
fi

mkdir -p "$RUN_DIR/lanes" "$RUN_DIR/locks"

python3 - "$RUN_DIR/run.json" "$RUN_ID" "$CREATED" "$GOAL" <<'PY'
import json, sys, os, tempfile
path, run_id, created, goal = sys.argv[1:5]
data = {
    "run_id": run_id,
    "created_at": created,
    "goal": goal,
    "status": "open",
}
dir_ = os.path.dirname(path) or "."
fd, tmp = tempfile.mkstemp(prefix=".herd-", suffix=".json", dir=dir_)
try:
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, path)
except Exception:
    try:
        os.unlink(tmp)
    except OSError:
        pass
    raise
PY

# Point CURRENT at this run (relative symlink for portability).
# If CURRENT is a *directory* (legacy bootstrap), ln -sfn would nest the link
# inside it — remove/replace so basename(resolve(CURRENT)) is the run id.
if [[ -e "$HERD_DIR/CURRENT" || -L "$HERD_DIR/CURRENT" ]]; then
  if [[ -L "$HERD_DIR/CURRENT" ]]; then
    rm -f "$HERD_DIR/CURRENT"
  elif [[ -d "$HERD_DIR/CURRENT" ]]; then
    # Preserve accidental dir content under a stamped name if it has lanes
    if [[ -f "$HERD_DIR/CURRENT/run.json" ]]; then
      mv "$HERD_DIR/CURRENT" "$HERD_DIR/legacy-CURRENT-$(date -u +%Y%m%dT%H%M%SZ)-$$"
    else
      rm -rf "$HERD_DIR/CURRENT"
    fi
  else
    rm -f "$HERD_DIR/CURRENT"
  fi
fi
ln -sfn "$RUN_ID" "$HERD_DIR/CURRENT"

echo "herd run created: $RUN_DIR"
echo "  run_id=$RUN_ID"
echo "  goal=${GOAL:-"(none)"}"
echo "  CURRENT -> $RUN_ID"
echo "  dirs: lanes/ locks/"
