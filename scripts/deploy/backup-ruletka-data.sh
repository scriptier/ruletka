#!/usr/bin/env bash
# Backup / restore hub social data: friends.json + star_ledger.jsonl (always together).
#
# Why together: star_ledger is authority for balances; friends.json is a cache +
# edges/bans/friends. Restoring friends alone after spends can look like a double-spend
# until ledger reloads — and restoring friends WITHOUT ledger can wipe audit history.
#
# Usage (on the droplet):
#   sudo bash /opt/ruletka/deploy/backup-ruletka-data.sh
#   sudo bash /opt/ruletka/deploy/backup-ruletka-data.sh backup
#   sudo bash /opt/ruletka/deploy/backup-ruletka-data.sh list
#   sudo bash /opt/ruletka/deploy/backup-ruletka-data.sh restore /opt/ruletka/backups/ruletka-data-….tgz
#
# Env:
#   ROULETKA_DATA_DIR   default /opt/ruletka/data
#   ROULETKA_BACKUP_DIR default /opt/ruletka/backups
#   ROULETKA_KEEP       default 14 (number of tarballs to keep)

set -euo pipefail

DATA_DIR="${ROULETKA_DATA_DIR:-/opt/ruletka/data}"
BACKUP_DIR="${ROULETKA_BACKUP_DIR:-/opt/ruletka/backups}"
KEEP="${ROULETKA_KEEP:-14}"
SERVICE="${ROULETKA_SERVICE:-roulette-bridge}"

FRIENDS="$DATA_DIR/friends.json"
LEDGER="$DATA_DIR/star_ledger.jsonl"
METRICS="$DATA_DIR/metrics.jsonl"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

cmd="${1:-backup}"

backup_now() {
  mkdir -p "$BACKUP_DIR"
  [[ -d "$DATA_DIR" ]] || die "data dir missing: $DATA_DIR"

  local stamp files=()
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  local out="$BACKUP_DIR/ruletka-data-${stamp}.tgz"
  local tmp
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT

  # Always include friends + ledger (create empty ledger snapshot note if missing)
  if [[ -f "$FRIENDS" ]]; then
    cp -a "$FRIENDS" "$tmp/friends.json"
  else
    echo '{}' >"$tmp/friends.json"
    log "WARN: friends.json missing — backed up empty {}"
  fi

  if [[ -f "$LEDGER" ]]; then
    cp -a "$LEDGER" "$tmp/star_ledger.jsonl"
  else
    : >"$tmp/star_ledger.jsonl"
    log "WARN: star_ledger.jsonl missing — backed up empty file"
  fi

  # Optional extras (nice to have)
  [[ -f "$METRICS" ]] && cp -a "$METRICS" "$tmp/metrics.jsonl" || true
  for f in admin.env turn.env analytics.env mod.env federation_peers.json directory_hubs.json; do
    [[ -f "$DATA_DIR/$f" ]] && cp -a "$DATA_DIR/$f" "$tmp/$f" || true
  done

  # Manifest for restore safety checks
  {
    echo "created_utc=$stamp"
    echo "host=$(hostname -f 2>/dev/null || hostname)"
    echo "friends_bytes=$(wc -c <"$tmp/friends.json" | tr -d ' ')"
    echo "ledger_lines=$(grep -c . "$tmp/star_ledger.jsonl" 2>/dev/null || echo 0)"
    if [[ -s "$tmp/star_ledger.jsonl" ]]; then
      echo "ledger_last=$(tail -1 "$tmp/star_ledger.jsonl" | head -c 200)"
    fi
  } >"$tmp/MANIFEST.txt"

  tar -C "$tmp" -czf "$out" .
  # Group-readable so deploy/ruletka can pull off-box; not world-readable
  chgrp ruletka "$out" 2>/dev/null || true
  chmod 640 "$out" 2>/dev/null || true
  log "backup ok: $out"
  ls -lh "$out"

  # Rotate old backups
  local n
  n="$(ls -1t "$BACKUP_DIR"/ruletka-data-*.tgz 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$n" -gt "$KEEP" ]]; then
    ls -1t "$BACKUP_DIR"/ruletka-data-*.tgz | tail -n +"$((KEEP + 1))" | while read -r old; do
      log "prune $old"
      rm -f "$old"
    done
  fi
}

list_backups() {
  mkdir -p "$BACKUP_DIR"
  ls -lht "$BACKUP_DIR"/ruletka-data-*.tgz 2>/dev/null || log "no backups yet in $BACKUP_DIR"
}

restore_now() {
  local archive="${1:-}"
  [[ -n "$archive" ]] || die "usage: $0 restore /path/to/ruletka-data-….tgz"
  [[ -f "$archive" ]] || die "archive not found: $archive"
  mkdir -p "$DATA_DIR"

  local tmp
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT
  tar -C "$tmp" -xzf "$archive"

  [[ -f "$tmp/friends.json" ]] || die "archive missing friends.json"
  [[ -f "$tmp/star_ledger.jsonl" ]] || die "archive missing star_ledger.jsonl — refuse restore (ledger required)"

  log "Restoring into $DATA_DIR from $archive"
  if [[ -f "$tmp/MANIFEST.txt" ]]; then
    log "manifest:"
    sed 's/^/  /' "$tmp/MANIFEST.txt" || true
  fi

  # Safety: stop bridge so we don't race live writes
  if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
    log "stopping $SERVICE"
    systemctl stop "$SERVICE"
  fi

  # Snapshot current state before overwrite
  local pre="$BACKUP_DIR/pre-restore-$(date -u +%Y%m%dT%H%M%SZ)"
  mkdir -p "$pre"
  [[ -f "$FRIENDS" ]] && cp -a "$FRIENDS" "$pre/" || true
  [[ -f "$LEDGER" ]] && cp -a "$LEDGER" "$pre/" || true
  log "pre-restore copy: $pre"

  install -m 644 "$tmp/friends.json" "$FRIENDS"
  install -m 644 "$tmp/star_ledger.jsonl" "$LEDGER"
  # Optional files only if present in archive
  for f in metrics.jsonl federation_peers.json directory_hubs.json; do
    if [[ -f "$tmp/$f" ]]; then
      install -m 644 "$tmp/$f" "$DATA_DIR/$f"
    fi
  done
  # env files — restore only if operator wants (sensitive); default include if present
  for f in admin.env turn.env analytics.env mod.env; do
    if [[ -f "$tmp/$f" ]]; then
      install -m 600 "$tmp/$f" "$DATA_DIR/$f"
    fi
  done

  # Ownership for service user if present
  if id ruletka &>/dev/null; then
    chown -R ruletka:ruletka "$DATA_DIR" 2>/dev/null || true
  fi

  log "starting $SERVICE"
  systemctl start "$SERVICE" || true
  sleep 1
  systemctl is-active "$SERVICE" && log "service active" || log "WARN: service not active — check journalctl -u $SERVICE"
  log "restore ok"
}

case "$cmd" in
  backup | b) backup_now ;;
  list | ls) list_backups ;;
  restore | r) restore_now "${2:-}" ;;
  -h | --help | help)
    sed -n '1,25p' "$0"
    ;;
  *)
    die "unknown command: $cmd (backup|list|restore)"
    ;;
esac
