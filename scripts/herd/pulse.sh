#!/usr/bin/env bash
# Update (merge) a lane JSON in the CURRENT herd run.
#
# Usage:
#   ./scripts/herd/pulse.sh <lane_id> --status working --goal "..." --own "file1,file2" --agent grok-sub
#   ./scripts/herd/pulse.sh <lane_id> --status blocked --reason "needs smoke"
#   ./scripts/herd/pulse.sh <lane_id> --status done --goal-met yes
#
# Options:
#   --status     idle|claimed|working|blocked|done|failed
#   --goal       one-line goal
#   --own        comma-separated path/glob list
#   --agent      grok-sub|claude|human|explore|...
#   --goal-met   yes|no|blocked|
#   --reason     blocked_reason (alias: --blocked-reason)
#   --notes      free text
#   --run DIR    override run dir (default: CURRENT)
set -euo pipefail

HERD_BIN="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$HERD_BIN"/*.sh 2>/dev/null || true

# shellcheck source=lib.sh
source "$HERD_BIN/lib.sh"
herd_load

usage() {
  cat <<'EOF' >&2
Usage: pulse.sh <lane_id> [options]

Options:
  --status STATUS       idle|claimed|working|blocked|done|failed
  --goal TEXT           one-line goal
  --own LIST            comma-separated paths/globs
  --agent NAME          e.g. grok-sub|claude|human|explore
  --goal-met VAL        yes|no|blocked|
  --reason TEXT         blocked_reason
  --blocked-reason TEXT same as --reason
  --notes TEXT
  --run DIR             run directory (default: CURRENT)
  -h, --help
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

LANE_ID=""
RUN_DIR=""
PATCHES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --status)
      [[ $# -ge 2 ]] || { echo "FAIL: --status needs value" >&2; exit 1; }
      PATCHES+=("status=$2")
      shift 2
      ;;
    --goal)
      [[ $# -ge 2 ]] || { echo "FAIL: --goal needs value" >&2; exit 1; }
      PATCHES+=("goal=$2")
      shift 2
      ;;
    --own)
      [[ $# -ge 2 ]] || { echo "FAIL: --own needs value" >&2; exit 1; }
      PATCHES+=("own=$2")
      shift 2
      ;;
    --agent)
      [[ $# -ge 2 ]] || { echo "FAIL: --agent needs value" >&2; exit 1; }
      PATCHES+=("agent=$2")
      shift 2
      ;;
    --goal-met)
      [[ $# -ge 2 ]] || { echo "FAIL: --goal-met needs value" >&2; exit 1; }
      PATCHES+=("goal_met=$2")
      shift 2
      ;;
    --reason|--blocked-reason)
      [[ $# -ge 2 ]] || { echo "FAIL: --reason needs value" >&2; exit 1; }
      PATCHES+=("blocked_reason=$2")
      shift 2
      ;;
    --notes)
      [[ $# -ge 2 ]] || { echo "FAIL: --notes needs value" >&2; exit 1; }
      PATCHES+=("notes=$2")
      shift 2
      ;;
    --run)
      [[ $# -ge 2 ]] || { echo "FAIL: --run needs value" >&2; exit 1; }
      RUN_DIR="$2"
      shift 2
      ;;
    --*)
      echo "FAIL: unknown option: $1" >&2
      usage
      exit 1
      ;;
    *)
      if [[ -z "$LANE_ID" ]]; then
        LANE_ID="$1"
        shift
      else
        echo "FAIL: unexpected arg: $1" >&2
        usage
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$LANE_ID" ]]; then
  echo "FAIL: lane_id required" >&2
  usage
  exit 1
fi

# Validate lane_id (safe filename)
if [[ ! "$LANE_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "FAIL: invalid lane_id '$LANE_ID' (use alnum . _ -)" >&2
  exit 1
fi

if [[ -z "$RUN_DIR" ]]; then
  if ! RUN_DIR="$(herd_require_run)"; then
    exit 1
  fi
elif [[ ! -d "$RUN_DIR" && -d "$HERD_DIR/$RUN_DIR" ]]; then
  # Accept bare run_id as well as absolute/relative path
  RUN_DIR="$HERD_DIR/$RUN_DIR"
fi

if [[ ! -d "$RUN_DIR" ]]; then
  echo "FAIL: run dir missing: $RUN_DIR" >&2
  exit 1
fi

mkdir -p "$RUN_DIR/lanes" "$RUN_DIR/locks"
LANE_FILE="$RUN_DIR/lanes/${LANE_ID}.json"

if [[ ${#PATCHES[@]} -eq 0 ]]; then
  # Touch / ensure exists with defaults only
  herd_lane_merge "$LANE_FILE" "$LANE_ID" >/dev/null
else
  herd_lane_merge "$LANE_FILE" "$LANE_ID" "${PATCHES[@]}" >/dev/null
fi

# Human one-liner summary
STATUS="$(herd_json_get "$LANE_FILE" status "?")"
GOAL="$(herd_json_get "$LANE_FILE" goal "")"
AGENT="$(herd_json_get "$LANE_FILE" agent "")"
echo "pulse ok: lane=$LANE_ID status=$STATUS agent=${AGENT:-"-"} goal=${GOAL:-"-"}"
echo "  file=$LANE_FILE"
