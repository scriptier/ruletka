#!/usr/bin/env bash
# freenet-roulette herd: OWN path locks (per-lane exclusive file ownership).
#
# Positional (preferred):
#   ./scripts/herd/own-lock.sh [--run DIR|RUN_ID] acquire <lane_id> path1 [path2...]
#   ./scripts/herd/own-lock.sh [--run DIR|RUN_ID] release <lane_id> [path...]
#   ./scripts/herd/own-lock.sh [--run DIR|RUN_ID] list
#   ./scripts/herd/own-lock.sh [--run DIR|RUN_ID] held-by <path>
#
# Flag style (register.sh compatible):
#   ./scripts/herd/own-lock.sh acquire --lane <id> --run <DIR|RUN_ID> --own path [--own path...]
#   ./scripts/herd/own-lock.sh release --lane <id> --run <DIR|RUN_ID> [--own path...]
#
# Lock files: artifacts/herd/<run>/locks/<sanitized-path>.lock
# Content:    {"lane":"...","path":"...","at":"ISO"}
# Sanitize:   / → __
#
# Prefer artifacts/herd/CURRENT (symlink → run dir, or dir, or file with run id).
# Standalone: creates CURRENT dir if nothing exists (no new-run/status dependency).
#
# Exit: 0 ok · 1 usage/error · 2 conflict (other lane holds path)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERD_ROOT="${HERD_ARTIFACT_DIR:-$ROOT/artifacts/herd}"
RUN_ARG=""   # raw --run value (dir path or run id)
RUN_DIR=""   # resolved absolute run directory
LANE=""
PATHS=()

usage() {
  cat <<'EOF' >&2
Usage:
  own-lock.sh [--run DIR|RUN_ID] acquire <lane_id> path1 [path2...]
  own-lock.sh [--run DIR|RUN_ID] release <lane_id> [path...]   # no paths → all for lane
  own-lock.sh [--run DIR|RUN_ID] list
  own-lock.sh [--run DIR|RUN_ID] held-by <path>

  # flag style (register.sh):
  own-lock.sh acquire --lane ID --run DIR|RUN_ID --own path [--own path...]
  own-lock.sh release --lane ID [--run DIR|RUN_ID] [--own path...]

Locks: artifacts/herd/<run>/locks/<sanitized-path>.lock
EOF
  exit 1
}

die() {
  echo "own-lock: $*" >&2
  exit 1
}

iso_now() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}

# Resolve RUN_ARG / CURRENT → RUN_DIR (absolute).
resolve_run_dir() {
  local candidate=""

  if [[ -n "$RUN_ARG" ]]; then
    candidate="$RUN_ARG"
    # Absolute or relative existing directory
    if [[ -d "$candidate" ]]; then
      RUN_DIR="$(cd "$candidate" && pwd)"
      return
    fi
    # Run id under herd root (README layout)
    if [[ -d "$HERD_ROOT/$candidate" ]]; then
      RUN_DIR="$(cd "$HERD_ROOT/$candidate" && pwd)"
      return
    fi
    # Legacy register layout: artifacts/herd/runs/<id>
    if [[ -d "$HERD_ROOT/runs/$candidate" ]]; then
      RUN_DIR="$(cd "$HERD_ROOT/runs/$candidate" && pwd)"
      return
    fi
    # Create under herd root (standalone — no new-run required)
    mkdir -p "$HERD_ROOT/$candidate"
    RUN_DIR="$(cd "$HERD_ROOT/$candidate" && pwd)"
    return
  fi

  # Prefer CURRENT symlink / dir / run-id file
  local cur="$HERD_ROOT/CURRENT"
  if [[ -L "$cur" ]]; then
    # Symlink to run dir or to run_id name
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

  # CURRENT as plain file containing run id (register.sh style)
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
      mkdir -p "$HERD_ROOT/$rid"
      RUN_DIR="$(cd "$HERD_ROOT/$rid" && pwd)"
      return
    fi
  fi

  # Standalone bootstrap: plain CURRENT directory
  mkdir -p "$cur"
  RUN_DIR="$(cd "$cur" && pwd)"
}

locks_dir() {
  echo "$RUN_DIR/locks"
}

# path → lock basename (/ → __)
sanitize_path() {
  local p="$1"
  p="${p#./}"
  while [[ "$p" == */ ]]; do p="${p%/}"; done
  echo "${p//\//__}"
}

lock_file_for() {
  echo "$(locks_dir)/$(sanitize_path "$1").lock"
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

write_lock_json() {
  local lane="$1" path="$2" at="$3"
  python3 -c \
    'import json,sys; print(json.dumps({"lane":sys.argv[1],"path":sys.argv[2],"at":sys.argv[3]}, separators=(",",":")))' \
    "$lane" "$path" "$at"
}

# Acquire one path. Idempotent for same lane. Exit 2 if other lane.
acquire_one() {
  local lane="$1" path="$2"
  local lf holder tmp
  lf="$(lock_file_for "$path")"
  mkdir -p "$(locks_dir)"

  if [[ -f "$lf" ]]; then
    holder="$(lock_field "$lf" lane)"
    if [[ "$holder" == "$lane" ]]; then
      echo "own-lock: already held by $lane: $path"
      return 0
    fi
    if [[ -n "$holder" ]]; then
      echo "own-lock: CONFLICT $path held by lane=$holder (wanted $lane)" >&2
      exit 2
    fi
    # corrupt lock — drop and recreate
    rm -f "$lf"
  fi

  tmp="$(write_lock_json "$lane" "$path" "$(iso_now)")"
  if (
    set -o noclobber
    printf '%s\n' "$tmp" >"$lf"
  ) 2>/dev/null; then
    echo "own-lock: acquired $path → $lane"
    return 0
  fi

  # Race lost — re-check holder
  if [[ -f "$lf" ]]; then
    holder="$(lock_field "$lf" lane)"
    if [[ "$holder" == "$lane" ]]; then
      echo "own-lock: already held by $lane: $path"
      return 0
    fi
    echo "own-lock: CONFLICT $path held by lane=${holder:-?} (wanted $lane)" >&2
    exit 2
  fi
  die "failed to create lock for $path"
}

release_one() {
  local lane="$1" path="$2"
  local lf holder
  lf="$(lock_file_for "$path")"
  if [[ ! -f "$lf" ]]; then
    echo "own-lock: not locked: $path"
    return 0
  fi
  holder="$(lock_field "$lf" lane)"
  if [[ "$holder" != "$lane" ]]; then
    echo "own-lock: refuse release $path (held by lane=${holder:-?}, not $lane)" >&2
    exit 2
  fi
  rm -f "$lf"
  echo "own-lock: released $path (was $lane)"
}

cmd_acquire() {
  [[ -n "$LANE" ]] || die "acquire requires lane_id"
  [[ ${#PATHS[@]} -gt 0 ]] || die "acquire requires at least one path"
  local p
  for p in "${PATHS[@]}"; do
    acquire_one "$LANE" "$p"
  done
}

cmd_release() {
  [[ -n "$LANE" ]] || die "release requires lane_id"
  mkdir -p "$(locks_dir)"

  if [[ ${#PATHS[@]} -eq 0 ]]; then
    local f holder path_field any=0
    shopt -s nullglob
    for f in "$(locks_dir)"/*.lock; do
      holder="$(lock_field "$f" lane)"
      if [[ "$holder" == "$LANE" ]]; then
        path_field="$(lock_field "$f" path)"
        rm -f "$f"
        echo "own-lock: released ${path_field:-$(basename "$f" .lock)} (was $LANE)"
        any=1
      fi
    done
    shopt -u nullglob
    if [[ $any -eq 0 ]]; then
      echo "own-lock: no locks held by $LANE"
    fi
    return 0
  fi

  local p
  for p in "${PATHS[@]}"; do
    release_one "$LANE" "$p"
  done
}

cmd_list() {
  mkdir -p "$(locks_dir)"
  local f path_field holder any=0
  shopt -s nullglob
  for f in "$(locks_dir)"/*.lock; do
    path_field="$(lock_field "$f" path)"
    holder="$(lock_field "$f" lane)"
    if [[ -z "$path_field" ]]; then
      path_field="$(basename "$f" .lock)"
      path_field="${path_field//__/\/}"
    fi
    printf '%s → %s\n' "$path_field" "${holder:-?}"
    any=1
  done
  shopt -u nullglob
  if [[ $any -eq 0 ]]; then
    echo "(no locks)"
  fi
}

cmd_held_by() {
  [[ ${#PATHS[@]} -eq 1 ]] || die "held-by requires exactly one path"
  local path="${PATHS[0]}"
  local lf holder
  lf="$(lock_file_for "$path")"
  if [[ ! -f "$lf" ]]; then
    echo "free"
    return 0
  fi
  holder="$(lock_field "$lf" lane)"
  echo "${holder:-unknown}"
}

# ── parse argv ──────────────────────────────────────────────────────
# Accept global --run before command; after command accept positional
# or --lane / --run / --own flags.

[[ $# -ge 1 ]] || usage

# Leading global flags
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
    -*)
      # unknown global flag before command — stop, might be misplaced
      break
      ;;
    *)
      break
      ;;
  esac
done

[[ $# -ge 1 ]] || usage
CMD="$1"
shift

# Command-local args: flags and/or positionals
while [[ $# -gt 0 ]]; do
  case "$1" in
    --lane)
      LANE="${2:-}"
      [[ -n "$LANE" ]] || die "--lane requires id"
      shift 2
      ;;
    --run)
      RUN_ARG="${2:-}"
      [[ -n "$RUN_ARG" ]] || die "--run requires DIR or RUN_ID"
      shift 2
      ;;
    --own)
      [[ -n "${2:-}" ]] || die "--own requires path"
      PATHS+=("$2")
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        PATHS+=("$1")
        shift
      done
      ;;
    -*)
      die "unknown flag: $1"
      ;;
    *)
      # Positional: first token after acquire/release is lane if not set
      if [[ -z "$LANE" && ( "$CMD" == "acquire" || "$CMD" == "release" ) ]]; then
        LANE="$1"
      else
        PATHS+=("$1")
      fi
      shift
      ;;
  esac
done

resolve_run_dir

case "$CMD" in
  acquire)  cmd_acquire ;;
  release)  cmd_release ;;
  list)     cmd_list ;;
  held-by)  cmd_held_by ;;
  *)
    echo "own-lock: unknown command: $CMD" >&2
    usage
    ;;
esac
