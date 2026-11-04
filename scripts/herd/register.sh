#!/usr/bin/env bash
# Register a herd lane job card for spawn_subagent paste.
#
# Usage:
#   ./scripts/herd/register.sh \
#     --lane lane-a \
#     --goal "Stage flag off" \
#     --own "mobile/src/live/LiveStageVideo.tsx" \
#     --own "mobile/src/live/liveStyles.ts" \
#     --done-when "no stage flag chip" \
#     --do-not "MediaSession.ts, deploy, APK" \
#     --agent grok-sub \
#     --read "docs/HERD.md"
#
# Layout (canonical): artifacts/herd/<run_id>/lanes/<lane>.md
# CURRENT is a symlink to <run_id> (see new-run.sh).
set -euo pipefail

HERD_BIN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$HERD_BIN"/*.sh 2>/dev/null || true
# shellcheck source=lib.sh
source "$HERD_BIN/lib.sh"
herd_load

TEMPLATE="$HERD_BIN/templates/lane-card.md"

LANE_ID=""
GOAL=""
DONE_WHEN=""
DO_NOT=""
AGENT="grok-sub"
EVAL="(none — use DONE WHEN as pass/fail)"
OWN_PATHS=()
READ_PATHS=()

usage() {
  cat <<'EOF'
Usage:
  ./scripts/herd/register.sh \
    --lane <id> \
    --goal "..." \
    --own <path> [--own <path> ...] \
    --done-when "..." \
    [--do-not "..."] \
    [--agent <name>] \
    [--read <path> ...] \
    [--eval "..."]

Requires: ./scripts/herd/new-run.sh first (artifacts/herd/CURRENT → run dir).
Writes:   artifacts/herd/<RUN_ID>/lanes/<lane>.md
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lane) LANE_ID="${2:-}"; shift 2 ;;
    --goal) GOAL="${2:-}"; shift 2 ;;
    --own)
      [[ -n "${2:-}" ]] || die "--own requires a path"
      OWN_PATHS+=("$2")
      shift 2
      ;;
    --done-when) DONE_WHEN="${2:-}"; shift 2 ;;
    --do-not) DO_NOT="${2:-}"; shift 2 ;;
    --agent) AGENT="${2:-}"; shift 2 ;;
    --read)
      [[ -n "${2:-}" ]] || die "--read requires a path"
      READ_PATHS+=("$2")
      shift 2
      ;;
    --eval) EVAL="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown arg: $1 (see --help)" ;;
  esac
done

[[ -n "$LANE_ID" ]] || die "--lane required"
[[ -n "$GOAL" ]] || die "--goal required"
[[ ${#OWN_PATHS[@]} -gt 0 ]] || die "at least one --own required"
[[ -n "$DONE_WHEN" ]] || die "--done-when required"
[[ -f "$TEMPLATE" ]] || die "template missing: $TEMPLATE"

RUN_DIR="$(herd_require_run)"
RUN_ID="$(basename "$RUN_DIR")"
LANES_DIR="$RUN_DIR/lanes"
CARD_PATH="$LANES_DIR/${LANE_ID}.md"
mkdir -p "$LANES_DIR" "$RUN_DIR/locks"

format_bullets() {
  if [[ $# -eq 0 ]]; then
    echo "- (none)"
    return
  fi
  local p
  for p in "$@"; do
    printf -- '- `%s`\n' "$p"
  done
}

OWN_TEXT="$(format_bullets "${OWN_PATHS[@]}")"
if [[ ${#READ_PATHS[@]} -gt 0 ]]; then
  READ_TEXT="$(format_bullets "${READ_PATHS[@]}")"
else
  READ_TEXT="- (none)"
fi
if [[ -z "$DO_NOT" ]]; then
  DO_NOT="deploy, APK, push.sh, pool>0, edit outside OWN, MediaSession thrash"
fi

# own-lock acquire (best-effort, fail hard on conflict)
if [[ -x "$HERD_BIN/own-lock.sh" ]]; then
  lock_args=(acquire --lane "$LANE_ID" --run "$RUN_DIR")
  for p in "${OWN_PATHS[@]}"; do
    lock_args+=(--own "$p")
  done
  if ! "$HERD_BIN/own-lock.sh" "${lock_args[@]}"; then
    die "own-lock acquire failed (path held by another lane)"
  fi
else
  echo "WARN: own-lock.sh missing — OWN not locked" >&2
fi

export LANE_ID GOAL OWN_TEXT READ_TEXT DONE_WHEN EVAL DO_NOT AGENT RUN_ID
python3 - "$TEMPLATE" "$CARD_PATH" <<'PY'
import os, sys
src, dst = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()
repl = {
    "{{LANE_ID}}": os.environ["LANE_ID"],
    "{{GOAL}}": os.environ["GOAL"],
    "{{OWN}}": os.environ["OWN_TEXT"],
    "{{READ}}": os.environ["READ_TEXT"],
    "{{DONE_WHEN}}": os.environ["DONE_WHEN"],
    "{{EVAL}}": os.environ["EVAL"],
    "{{DO_NOT}}": os.environ["DO_NOT"],
    "{{AGENT}}": os.environ["AGENT"],
    "{{RUN_ID}}": os.environ["RUN_ID"],
}
for k, v in repl.items():
    text = text.replace(k, v)
open(dst, "w", encoding="utf-8").write(text)
PY

OWN_CSV="$(IFS=,; echo "${OWN_PATHS[*]}")"
"$HERD_BIN/pulse.sh" "$LANE_ID" \
  --status claimed \
  --goal "$GOAL" \
  --own "$OWN_CSV" \
  --agent "$AGENT" \
  --run "$RUN_DIR" || true
"$HERD_BIN/pulse.sh" "$LANE_ID" \
  --status working \
  --goal "$GOAL" \
  --own "$OWN_CSV" \
  --agent "$AGENT" \
  --run "$RUN_DIR" || true

python3 - "$CARD_PATH" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
text2, n = re.subn(
    r"(\|\s*\*\*STATUS\*\*\s*\|\s*)claimed(\s*\|)",
    r"\1working\2",
    text,
    count=1,
)
if n:
    open(path, "w", encoding="utf-8").write(text2)
PY

echo "REGISTERED lane=$LANE_ID run=$RUN_ID"
echo "CARD=$CARD_PATH"
echo ""
echo "---- spawn_subagent: paste this card as the worker prompt ----"
cat "$CARD_PATH"
echo "---- end card ----"
echo ""
echo "Finish later:"
echo "  ./scripts/herd/finish.sh $LANE_ID --goal-met yes|no|blocked [--notes \"...\"]"
