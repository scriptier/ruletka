#!/usr/bin/env bash
# Poll CURRENT herd run until all lanes are terminal (done|failed|blocked)
# or there are no lanes.
#
# Usage: ./scripts/herd/wait-all.sh [--timeout 600] [--interval 2] [--run DIR]
#
# Exit codes:
#   0  all lanes done (or no lanes)
#   1  timeout
#   2  any failed (and none still active)
#   3  any blocked (and none still active; no failed)
#   4  no CURRENT run
set -euo pipefail

HERD_BIN="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$HERD_BIN"/*.sh 2>/dev/null || true

# shellcheck source=lib.sh
source "$HERD_BIN/lib.sh"
herd_load

TIMEOUT=600
INTERVAL=2
RUN_DIR=""

usage() {
  cat <<'EOF' >&2
Usage: wait-all.sh [--timeout SEC] [--interval SEC] [--run DIR]

Poll until every lane in the CURRENT run is done|failed|blocked (or no lanes).

Exit:
  0  all done (or empty)
  1  timeout
  2  any failed
  3  any blocked (no failed)
  4  no CURRENT run
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --timeout)
      [[ $# -ge 2 ]] || { echo "FAIL: --timeout needs value" >&2; exit 1; }
      TIMEOUT="$2"
      shift 2
      ;;
    --interval)
      [[ $# -ge 2 ]] || { echo "FAIL: --interval needs value" >&2; exit 1; }
      INTERVAL="$2"
      shift 2
      ;;
    --run)
      [[ $# -ge 2 ]] || { echo "FAIL: --run needs value" >&2; exit 1; }
      RUN_DIR="$2"
      shift 2
      ;;
    *)
      echo "FAIL: unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$RUN_DIR" ]]; then
  if ! RUN_DIR="$(herd_require_run)"; then
    exit 4
  fi
elif [[ ! -d "$RUN_DIR" && -d "$HERD_DIR/$RUN_DIR" ]]; then
  RUN_DIR="$HERD_DIR/$RUN_DIR"
fi

if [[ ! -d "$RUN_DIR" ]]; then
  echo "FAIL: run dir missing: $RUN_DIR" >&2
  exit 4
fi

echo "wait-all: run=$(basename "$RUN_DIR") timeout=${TIMEOUT}s interval=${INTERVAL}s"

START_TS=$(date +%s)
DEADLINE=$((START_TS + TIMEOUT))

while true; do
  RESULT="$(python3 - "$RUN_DIR" <<'PY'
import json, os, sys, glob
run_dir = sys.argv[1]
lanes_dir = os.path.join(run_dir, "lanes")
statuses = []
if os.path.isdir(lanes_dir):
    for path in sorted(glob.glob(os.path.join(lanes_dir, "*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            st = (data.get("status") or "idle") if isinstance(data, dict) else "failed"
        except Exception:
            st = "failed"
        statuses.append(st)

terminal = {"done", "failed", "blocked"}
active = [s for s in statuses if s not in terminal]
n = len(statuses)
n_done = sum(1 for s in statuses if s == "done")
n_failed = sum(1 for s in statuses if s == "failed")
n_blocked = sum(1 for s in statuses if s == "blocked")
n_active = len(active)

# outcome when quiescent
if n == 0:
    print("DONE empty=1 active=0 done=0 failed=0 blocked=0")
elif n_active > 0:
    print(f"WAIT active={n_active} done={n_done} failed={n_failed} blocked={n_blocked} total={n}")
elif n_failed > 0:
    print(f"FAILED active=0 done={n_done} failed={n_failed} blocked={n_blocked} total={n}")
elif n_blocked > 0:
    print(f"BLOCKED active=0 done={n_done} failed={n_failed} blocked={n_blocked} total={n}")
else:
    print(f"DONE active=0 done={n_done} failed={n_failed} blocked={n_blocked} total={n}")
PY
)"

  kind="${RESULT%% *}"
  echo "  $(herd_now) $RESULT"

  case "$kind" in
    DONE)
      echo "wait-all: all clear"
      exit 0
      ;;
    FAILED)
      echo "wait-all: some lanes failed"
      exit 2
      ;;
    BLOCKED)
      echo "wait-all: some lanes blocked"
      exit 3
      ;;
    WAIT)
      ;;
    *)
      echo "wait-all: unexpected state: $RESULT" >&2
      exit 1
      ;;
  esac

  NOW_TS=$(date +%s)
  if (( NOW_TS >= DEADLINE )); then
    echo "wait-all: timeout after ${TIMEOUT}s ($RESULT)" >&2
    exit 1
  fi
  sleep "$INTERVAL"
done
