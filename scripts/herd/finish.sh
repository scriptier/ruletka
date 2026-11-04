#!/usr/bin/env bash
# Finish a herd lane: release OWN locks + pulse terminal status + stamp REPORT.
#
# Usage:
#   ./scripts/herd/finish.sh <lane_id> --goal-met yes|no|blocked [--notes "..."]
#   ./scripts/herd/finish.sh <lane_id> --goal-met yes --files-changed "a.ts,b.ts"
set -euo pipefail

HERD_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$HERD_BIN"/*.sh 2>/dev/null || true
# shellcheck source=lib.sh
source "$HERD_BIN/lib.sh"
herd_load

LANE_ID=""
GOAL_MET=""
NOTES=""
FILES_CHANGED=""

usage() {
  cat <<'EOF'
Usage:
  ./scripts/herd/finish.sh <lane_id> --goal-met yes|no|blocked [--notes "..."] [--files-changed "..."]

Requires: CURRENT run (new-run.sh). Releases own-lock; pulses done|failed|blocked.
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

case "${1:-}" in
  -h|--help) usage; exit 0 ;;
  --*) die "lane_id is required as first argument" ;;
  *) LANE_ID="$1"; shift ;;
esac

while [[ $# -gt 0 ]]; do
  case "$1" in
    --goal-met) GOAL_MET="${2:-}"; shift 2 ;;
    --notes) NOTES="${2:-}"; shift 2 ;;
    --files-changed) FILES_CHANGED="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown arg: $1" ;;
  esac
done

[[ -n "$LANE_ID" ]] || die "lane_id required"
[[ -n "$GOAL_MET" ]] || die "--goal-met required (yes|no|blocked)"
case "$GOAL_MET" in
  yes|no|blocked) ;;
  *) die "--goal-met must be yes|no|blocked (got: $GOAL_MET)" ;;
esac

RUN_DIR="$(herd_require_run)"
RUN_ID="$(basename "$RUN_DIR")"
CARD_PATH="$RUN_DIR/lanes/${LANE_ID}.md"
[[ -f "$CARD_PATH" ]] || die "lane card not found: $CARD_PATH"

PULSE_STATUS=""
case "$GOAL_MET" in
  yes) PULSE_STATUS="done" ;;
  no) PULSE_STATUS="failed" ;;
  blocked) PULSE_STATUS="blocked" ;;
esac

if [[ -x "$HERD_BIN/own-lock.sh" ]]; then
  "$HERD_BIN/own-lock.sh" release --lane "$LANE_ID" --run "$RUN_DIR" || \
    echo "WARN: own-lock release failed (continuing)" >&2
fi

"$HERD_BIN/pulse.sh" "$LANE_ID" \
  --status "$PULSE_STATUS" \
  --goal-met "$GOAL_MET" \
  --notes "$NOTES" \
  --run "$RUN_DIR" || \
  echo "WARN: pulse failed (continuing)" >&2

export CARD_PATH GOAL_MET NOTES FILES_CHANGED PULSE_STATUS
python3 <<'PY'
import os, re
path = os.environ["CARD_PATH"]
goal = os.environ["GOAL_MET"]
notes = os.environ.get("NOTES", "")
files = os.environ.get("FILES_CHANGED", "")
status = os.environ["PULSE_STATUS"]
text = open(path, encoding="utf-8").read()
text = re.sub(
    r"(\|\s*\*\*STATUS\*\*\s*\|\s*)[^|\n]+",
    rf"\1{status} ",
    text,
    count=1,
)
report = (
    "## REPORT\n\n```\n"
    f"GOAL_MET={goal}\n"
    "FILES_CHANGED:\n"
)
if files.strip():
    for part in re.split(r"\s*,\s*", files.strip()):
        if part:
            report += f"- {part}\n"
else:
    report += "(none listed)\n"
report += "NOTES:\n"
report += (notes if notes else "(none)") + "\n```\n"
if re.search(r"(?im)^## REPORT\b", text):
    text = re.sub(r"(?ims)^## REPORT\b.*?(?=\Z)", report.rstrip() + "\n", text, count=1)
else:
    text = text.rstrip() + "\n\n" + report
open(path, "w", encoding="utf-8").write(text)
PY

echo "FINISHED lane=$LANE_ID run=$RUN_ID goal_met=$GOAL_MET pulse=$PULSE_STATUS"
echo "CARD=$CARD_PATH"
