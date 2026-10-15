#!/usr/bin/env bash
# freenet-roulette herd: pre-spawn OWN conflict check.
#
# Usage:
#   ./scripts/herd/own-check.sh [--run DIR|RUN_ID] path1 [path2...]
#
# Exit 0 if none of the paths are locked.
# Exit 2 if any path is locked (print holders).
# Exit 1 usage / bad args.
#
# Used by director before spawn. Standalone under CURRENT or --run.
# Does not create runs; missing CURRENT → all free (exit 0).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERD_ROOT="${HERD_ARTIFACT_DIR:-$ROOT/artifacts/herd}"
RUN_ARG=""
RUN_DIR=""

usage() {
  cat <<'EOF' >&2
Usage:
  own-check.sh [--run DIR|RUN_ID] path1 [path2...]

Exit 0 if none locked; exit 2 if any locked (prints holders).
EOF
  exit 1
}

die() {
  echo "own-check: $*" >&2
  exit 1
}

resolve_run_dir() {
  local candidate=""

  if [[ -n "$RUN_ARG" ]]; then
    candidate="$RUN_ARG"
    if [[ -d "$candidate" ]]; then
      RUN_DIR="$(cd "$candidate" && pwd)"
      return
    fi
    if [[ -d "$HERD_ROOT/$candidate" ]]; then
      RUN_DIR="$(cd "$HERD_ROOT/$candidate" && pwd)"
      return
    fi
    if [[ -d "$HERD_ROOT/runs/$candidate" ]]; then
      RUN_DIR="$(cd "$HERD_ROOT/runs/$candidate" && pwd)"
      return
    fi
    # Run does not exist yet → free
    RUN_DIR=""
    return
  fi

  local cur="$HERD_ROOT/CURRENT"
  if [[ -L "$cur" ]]; then
    if [[ -d "$cur" ]]; then
      RUN_DIR="$(cd "$cur" && pwd)"
      return
    fi
    local target
    target="$(readlink "$cur" 2>/dev/null || true)"
    if [[ -n "$target" && -d "$HERD_ROOT/$target" ]]; then
      RUN_DIR="$(cd "$HERD_ROOT/$target" && pwd)"
      return
    fi
    if [[ -n "$target" && -d "$target" ]]; then
      RUN_DIR="$(cd "$target" && pwd)"
      return
    fi
  fi

  if [[ -d "$cur" ]]; then
    RUN_DIR="$(cd "$cur" && pwd)"
    return
  fi

  if [[ -f "$cur" ]]; then
    local rid
    rid="$(tr -d '[:space:]' <"$cur")"
    if [[ -n "$rid" ]]; then
      if [[ -d "$HERD_ROOT/$rid" ]]; then
        RUN_DIR="$(cd "$HERD_ROOT/$rid" && pwd)"
        return
      fi
      if [[ -d "$HERD_ROOT/runs/$rid" ]]; then
        RUN_DIR="$(cd "$HERD_ROOT/runs/$rid" && pwd)"
        return
      fi
    fi
  fi

  # No active run → nothing locked
  RUN_DIR=""
}

sanitize_path() {
  local p="$1"
  p="${p#./}"
  while [[ "$p" == */ ]]; do p="${p%/}"; done
  echo "${p//\//__}"
}

lock_field() {
  local file="$1" field="$2"
  python3 - "$file" "$field" <<'PY' 2>/dev/null || true
import json, sys
try:
    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)
    v = data.get(sys.argv[2], "")
    print("" if v is None else v)
except Exception:
    pass
PY
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run)
      RUN_ARG="${2:-}"
      [[ -n "$RUN_ARG" ]] || die "--run requires DIR or RUN_ID"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    --)
      shift
      break
      ;;
    -*)
      die "unknown flag: $1"
      ;;
    *)
      break
      ;;
  esac
done

[[ $# -ge 1 ]] || usage

resolve_run_dir

# No CURRENT / run → free
if [[ -z "$RUN_DIR" ]]; then
  exit 0
fi

LOCKS="$RUN_DIR/locks"
conflicts=0

for path in "$@"; do
  lf="$LOCKS/$(sanitize_path "$path").lock"
  if [[ -f "$lf" ]]; then
    holder="$(lock_field "$lf" lane)"
    at="$(lock_field "$lf" at)"
    echo "LOCKED $path → lane=${holder:-?} at=${at:-?}"
    conflicts=1
  fi
done

if [[ $conflicts -ne 0 ]]; then
  exit 2
fi
exit 0
