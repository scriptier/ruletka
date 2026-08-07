#!/usr/bin/env bash
# Shared helpers for overnight admin agent (v4.2 — dual-agent: Claude build + Grok manage/judge).
set -euo pipefail

admin_agent_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

admin_load_config() {
  local root cfg
  root="$(admin_agent_root)"
  cfg="$root/scripts/admin-agent/config.env"
  # shellcheck disable=SC1091
  if [[ -f "$cfg" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$cfg"
    set +a
  fi
  ROOT="${ROOT:-$root}"
  ENABLE_CLAUDE="${ENABLE_CLAUDE:-1}"
  ENABLE_GROK="${ENABLE_GROK:-1}"
  ENABLE_AUTO_ENQUEUE="${ENABLE_AUTO_ENQUEUE:-1}"
  ENABLE_BRANCH_ISOLATION="${ENABLE_BRANCH_ISOLATION:-1}"
  ENABLE_VERIFY="${ENABLE_VERIFY:-1}"
  ENABLE_ALERTS="${ENABLE_ALERTS:-1}"
  # Ralph-style retry after failed verify (fresh prompt with failure feedback)
  ENABLE_RALPH_RETRY="${ENABLE_RALPH_RETRY:-1}"
  RALPH_MAX_ATTEMPTS="${RALPH_MAX_ATTEMPTS:-2}"
  # Commit on admin/* worktree only — never push
  ENABLE_AUTO_COMMIT="${ENABLE_AUTO_COMMIT:-1}"
  # When Claude hits session limit, sleep until CLAUDE_RESET_LOCAL (+ buffer)
  ENABLE_RATE_LIMIT_BACKOFF="${ENABLE_RATE_LIMIT_BACKOFF:-1}"
  CLAUDE_RESET_LOCAL="${CLAUDE_RESET_LOCAL:-06:30}"
  CLAUDE_RESET_BUFFER_SEC="${CLAUDE_RESET_BUFFER_SEC:-300}"
  ALLOW_DEPLOY="${ALLOW_DEPLOY:-0}"
  SSH_KEY="${SSH_KEY:-$HOME/.ssh/ruletka_ed25519}"
  SSH_HOST="${SSH_HOST:-root@209.38.204.153}"
  HUB_LOOKBACK_MIN="${HUB_LOOKBACK_MIN:-90}"
  CLAUDE_TIMEOUT_SEC="${CLAUDE_TIMEOUT_SEC:-1800}"
  MAX_TASKS_PER_CYCLE="${MAX_TASKS_PER_CYCLE:-2}"
  NIGHTLY_INTERVAL_SEC="${NIGHTLY_INTERVAL_SEC:-5400}"
  NIGHTLY_MAX_CYCLES="${NIGHTLY_MAX_CYCLES:-6}"
  NIGHTLY_STOP_HOUR="${NIGHTLY_STOP_HOUR:-7}"
  # Full MORNING-BRIEF only on last nightly cycle (cheaper)
  GROK_ONLY_LAST_CYCLE="${GROK_ONLY_LAST_CYCLE:-1}"
  # Mid-night judge after N successful Claude tasks (across cycles)
  ENABLE_GROK_MIDNIGHT_JUDGE="${ENABLE_GROK_MIDNIGHT_JUDGE:-1}"
  GROK_JUDGE_EVERY_N_CLAUDE="${GROK_JUDGE_EVERY_N_CLAUDE:-2}"
  # When Claude rate-limited: run Grok manager (re-rank queue) instead of idle
  ENABLE_GROK_DURING_RATE_LIMIT="${ENABLE_GROK_DURING_RATE_LIMIT:-1}"
  GROK_MAX_TURNS_JUDGE="${GROK_MAX_TURNS_JUDGE:-15}"
  GROK_MAX_TURNS_MANAGER="${GROK_MAX_TURNS_MANAGER:-15}"
  GROK_MAX_TURNS_MORNING="${GROK_MAX_TURNS_MORNING:-20}"
  # Kill runaway grok manager/judge (seconds)
  GROK_TIMEOUT_SEC="${GROK_TIMEOUT_SEC:-900}"
  SLOW_OFFER_MS="${SLOW_OFFER_MS:-5000}"
  ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
  export PATH="${PATH:-}:$HOME/.local/bin:$HOME/.config/Claude/claude-code/2.1.222"
  mkdir -p \
    "$ROOT/scripts/admin-agent/logs" \
    "$ROOT/scripts/admin-agent/logs/alerts" \
    "$ROOT/.admin-worktrees" \
    "$ROOT/tasks/admin-queue/pending" \
    "$ROOT/tasks/admin-queue/running" \
    "$ROOT/tasks/admin-queue/done" \
    "$ROOT/tasks/admin-queue/failed" \
    "$ROOT/tasks/admin-queue/blocked" \
    "$ROOT/tasks/admin-queue/reports" \
    "$ROOT/scripts/claude-logs"
}

# Successful Claude tasks since last mid-night judge (not rate-limited)
admin_claude_success_count_get() {
  local f="$ROOT/scripts/admin-agent/logs/claude-success-count.env"
  local n=0
  if [[ -f "$f" ]]; then
    # shellcheck source=/dev/null
    source "$f"
    n="${CLAUDE_SUCCESS_COUNT:-0}"
  fi
  echo "$n"
}

admin_claude_success_count_set() {
  local n="${1:-0}"
  cat >"$ROOT/scripts/admin-agent/logs/claude-success-count.env" <<EOF
CLAUDE_SUCCESS_COUNT=$n
UPDATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
}

admin_claude_success_count_inc() {
  local n
  n="$(admin_claude_success_count_get)"
  n=$((n + 1))
  admin_claude_success_count_set "$n"
  admin_log "Claude success count → $n (judge every ${GROK_JUDGE_EVERY_N_CLAUDE})"
  echo "$n"
}

# Seconds until next local HH:MM (today or tomorrow). Echo integer >= 0.
admin_seconds_until_local_hhmm() {
  local hhmm="${1:-06:30}"
  local now target
  now="$(date +%s)"
  target="$(date -d "today ${hhmm}" +%s 2>/dev/null || date -d "${hhmm}" +%s)"
  if (( target <= now )); then
    target="$(date -d "tomorrow ${hhmm}" +%s 2>/dev/null || echo $((now + 3600)))"
  fi
  echo $(( target - now ))
}

# If rate-limited, prefer sleeping until Claude reset; else normal interval.
# Echoes seconds to sleep.
admin_next_sleep_seconds() {
  local interval="${1:-$NIGHTLY_INTERVAL_SEC}"
  local flag="$ROOT/scripts/admin-agent/logs/rate-limited.flag"
  local reset_file="$ROOT/scripts/admin-agent/logs/claude-reset-at.env"
  local wait=0

  if [[ "${ENABLE_RATE_LIMIT_BACKOFF}" != "1" ]]; then
    echo "$interval"
    return 0
  fi
  if [[ ! -f "$flag" ]]; then
    echo "$interval"
    return 0
  fi

  local hhmm="$CLAUDE_RESET_LOCAL"
  # Prefer parsed reset from last Claude log if present
  if [[ -f "$reset_file" ]]; then
    # shellcheck source=/dev/null
    source "$reset_file"
    [[ -n "${CLAUDE_RESET_HHMM:-}" ]] && hhmm="$CLAUDE_RESET_HHMM"
  fi

  wait="$(admin_seconds_until_local_hhmm "$hhmm")"
  wait=$(( wait + CLAUDE_RESET_BUFFER_SEC ))
  # Cap absurd waits (e.g. misparsed) at 8h
  if (( wait > 28800 )); then wait=28800; fi
  if (( wait < 60 )); then wait=60; fi
  admin_log "rate-limit backoff: sleep ${wait}s until ~${hhmm} + ${CLAUDE_RESET_BUFFER_SEC}s buffer"
  echo "$wait"
}

# Parse "resets 6:30am" style lines from a Claude log into claude-reset-at.env
admin_record_rate_limit_reset() {
  local log="${1:-}"
  local line hh mm ap hh24
  [[ -f "$log" ]] || return 0
  line="$(grep -oiE 'resets[[:space:]]+[0-9]{1,2}:[0-9]{2}[[:space:]]*(am|pm)?' "$log" 2>/dev/null | tail -1 || true)"
  [[ -n "$line" ]] || return 0
  # e.g. resets 6:30am
  if [[ "$line" =~ ([0-9]{1,2}):([0-9]{2})[[:space:]]*([aApP][mM])? ]]; then
    hh="${BASH_REMATCH[1]}"
    mm="${BASH_REMATCH[2]}"
    ap="${BASH_REMATCH[3]:-}"
    hh24=$((10#$hh))
    if [[ "$ap" =~ [pP] ]] && (( hh24 < 12 )); then hh24=$((hh24 + 12)); fi
    if [[ "$ap" =~ [aA] ]] && (( hh24 == 12 )); then hh24=0; fi
    printf -v CLAUDE_RESET_HHMM '%02d:%02d' "$hh24" "$((10#$mm))"
    {
      echo "CLAUDE_RESET_HHMM=$CLAUDE_RESET_HHMM"
      echo "PARSED_FROM=$line"
      echo "AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    } >"$ROOT/scripts/admin-agent/logs/claude-reset-at.env"
    admin_log "parsed Claude reset ~$CLAUDE_RESET_HHMM (from '$line')"
  fi
}

# Remove empty/noise admin worktrees left by rate-limit thrash
admin_cleanup_empty_worktrees() {
  local d branch ahead
  [[ -d "$ROOT/.admin-worktrees" ]] || return 0
  for d in "$ROOT/.admin-worktrees"/*; do
    [[ -d "$d" ]] || continue
    # Skip if Claude might still be using it
    if [[ -f "$ROOT/scripts/claude-logs/admin-claude.pid" ]]; then
      local pid
      pid="$(cat "$ROOT/scripts/claude-logs/admin-claude.pid" 2>/dev/null || true)"
      if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        continue
      fi
    fi
    ahead="$(git -C "$d" rev-list --count main..HEAD 2>/dev/null || echo 0)"
    # No commits ahead of main → safe to drop
    if [[ "$ahead" == "0" ]]; then
      branch="$(cat "$d/.admin-branch-name" 2>/dev/null || true)"
      admin_log "cleanup empty worktree $d"
      git -C "$ROOT" worktree remove --force "$d" 2>/dev/null || rm -rf "$d"
      if [[ -n "$branch" ]]; then
        git -C "$ROOT" branch -D "$branch" 2>/dev/null || true
      fi
    fi
  done
  git -C "$ROOT" worktree prune 2>/dev/null || true
}

admin_log() {
  local msg="$*"
  local ts
  ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  # Always stderr so command substitutions (e.g. work="$(admin_prepare_worktree …)") stay clean
  echo "[$ts] $msg" >&2
  echo "[$ts] $msg" >>"$ROOT/scripts/admin-agent/logs/agent.log"
}

admin_report_file() {
  echo "$ROOT/tasks/admin-queue/reports/$(date +%F).md"
}

admin_report_append() {
  local f
  f="$(admin_report_file)"
  if [[ ! -f "$f" ]]; then
    cat >"$f" <<EOF
# Admin agent report — $(date +%F)

Generated by \`scripts/admin-agent\` v3. Review in the morning before deploying.

EOF
  fi
  {
    echo ""
    echo "---"
    echo ""
    echo "### $(date -u +%H:%M:%SZ) UTC"
    echo ""
    cat
  } >>"$f"
}

admin_reap_stale_claude() {
  local pid_file="$ROOT/scripts/claude-logs/admin-claude.pid"
  local pid age
  [[ -f "$pid_file" ]] || return 0
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 0
  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$pid_file"
    return 0
  fi
  age=$(( $(date +%s) - $(stat -c %Y "$pid_file" 2>/dev/null || echo 0) ))
  if (( age > CLAUDE_TIMEOUT_SEC + 300 )); then
    admin_log "Reaping stale Claude pid=$pid age=${age}s"
    kill "$pid" 2>/dev/null || true
    sleep 2
    kill -9 "$pid" 2>/dev/null || true
    rm -f "$pid_file"
    find "$ROOT/tasks/admin-queue/running" -maxdepth 1 -type f -name '*.md' -print0 2>/dev/null \
      | while IFS= read -r -d '' f; do
          mv "$f" "$ROOT/tasks/admin-queue/failed/$(basename "$f")" 2>/dev/null || true
        done
  else
    admin_log "Claude still running pid=$pid age=${age}s — skip new Claude this cycle"
    return 1
  fi
  return 0
}

admin_git_snapshot() {
  local dir="${1:-$ROOT}"
  {
    echo "## Git snapshot (\`${dir#$ROOT/}\`)"
    echo ""
    echo '```'
    (cd "$dir" && git status -sb 2>/dev/null || echo "not a git repo")
    echo ""
    (cd "$dir" && git diff --stat 2>/dev/null | tail -40 || true)
    echo '```'
  }
}

admin_hub_forensics() {
  local tmp
  tmp="$(mktemp)"
  ADMIN_HUB_MATCHES=0
  ADMIN_HUB_OFFERS=0
  ADMIN_HUB_ANSWERS=0
  ADMIN_HUB_DROPS=0
  ADMIN_HUB_SLOW=0
  ADMIN_HUB_MAX_MTO=0
  local verdict="unknown"

  if [[ ! -f "$SSH_KEY" ]]; then
    echo "No SSH key at $SSH_KEY — skip hub forensics"
    return 0
  fi
  if ! ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o ConnectTimeout=12 -o BatchMode=yes \
    "$SSH_HOST" \
    "journalctl -u roulette-bridge --since '${HUB_LOOKBACK_MIN} min ago' --no-pager -o short-iso 2>/dev/null" \
    >"$tmp" 2>/dev/null; then
    echo "Hub SSH failed (offline or key issue)"
    rm -f "$tmp"
    return 0
  fi

  ADMIN_HUB_MATCHES=$(grep -c 'solo matched' "$tmp" || true)
  ADMIN_HUB_OFFERS=$(grep -c 'kind=offer' "$tmp" || true)
  ADMIN_HUB_ANSWERS=$(grep -c 'kind=answer' "$tmp" || true)
  ADMIN_HUB_DROPS=$(grep -c 'offer dropped' "$tmp" || true)

  local mto_source="none"
  if grep -q 'match_to_offer_ms' "$tmp"; then
    mto_source="hub_field"
    ADMIN_HUB_MAX_MTO=$(
      grep -oE 'match_to_offer_ms=[0-9]+' "$tmp" \
        | cut -d= -f2 \
        | sort -n \
        | tail -1 || echo 0
    )
    ADMIN_HUB_SLOW=$(
      grep -oE 'match_to_offer_ms=[0-9]+' "$tmp" \
        | cut -d= -f2 \
        | awk -v lim="$SLOW_OFFER_MS" '$1+0 > lim+0 {c++} END{print c+0}'
    )
  else
    # Fallback: match ISO timestamp → next kind=offer (same idea as hub-match-speed.sh)
    mto_source="timestamp_delta"
    read -r ADMIN_HUB_MAX_MTO ADMIN_HUB_SLOW <<EOF
$(awk -v lim="$SLOW_OFFER_MS" '
  /solo matched/ {
    ts=$1
    gsub(/T/," ",ts); sub(/\+.*/,"",ts); sub(/Z/,"",ts)
    cmd="date -d \"" ts "\" +%s 2>/dev/null"
    cmd | getline t; close(cmd)
    if (t+0>0) last_match=t+0
  }
  /kind=offer/ && last_match>0 {
    ts=$1
    gsub(/T/," ",ts); sub(/\+.*/,"",ts); sub(/Z/,"",ts)
    cmd="date -d \"" ts "\" +%s 2>/dev/null"
    cmd | getline t; close(cmd)
    if (t+0>0) {
      d=(t-last_match)*1000
      if (d>=0 && d<120000) {
        if (d>max) max=d
        if (d>lim) slow++
      }
      last_match=0
    }
  }
  END { print max+0, slow+0 }
' "$tmp")
EOF
  fi

  if (( ADMIN_HUB_MATCHES == 0 )); then
    verdict="idle"
  elif (( ADMIN_HUB_OFFERS == 0 && ADMIN_HUB_MATCHES > 0 )); then
    verdict="RED_zero_offers"
  elif (( ADMIN_HUB_OFFERS > 0 && ADMIN_HUB_ANSWERS == 0 )); then
    verdict="RED_no_answers"
  elif (( ADMIN_HUB_SLOW > 0 || ADMIN_HUB_MAX_MTO > SLOW_OFFER_MS )); then
    verdict="YELLOW_slow"
  elif (( ADMIN_HUB_DROPS > ADMIN_HUB_OFFERS )); then
    verdict="YELLOW_thrash"
  else
    verdict="GREEN"
  fi

  {
    echo "## Hub forensics (last ${HUB_LOOKBACK_MIN}m)"
    echo ""
    echo '```'
    grep -E 'solo matched|first offer after match|kind=offer|kind=answer|offer dropped|platform_|match_to_offer' "$tmp" \
      | tail -40 || echo "(no match/offer lines)"
    echo '```'
    echo ""
    echo "| metric | count |"
    echo "|--------|------:|"
    echo "| matches | $ADMIN_HUB_MATCHES |"
    echo "| offers | $ADMIN_HUB_OFFERS |"
    echo "| answers | $ADMIN_HUB_ANSWERS |"
    echo "| offer drops | $ADMIN_HUB_DROPS |"
    echo "| slow offers (>${SLOW_OFFER_MS}ms) | $ADMIN_HUB_SLOW |"
    echo "| max match_to_offer_ms | $ADMIN_HUB_MAX_MTO |"
    echo "| mto source | $mto_source |"
    echo ""
    echo "**Verdict:** \`$verdict\`"
    echo ""
  }

  cat >"$ROOT/scripts/admin-agent/logs/last-hub-metrics.env" <<EOF
ADMIN_HUB_MATCHES=$ADMIN_HUB_MATCHES
ADMIN_HUB_OFFERS=$ADMIN_HUB_OFFERS
ADMIN_HUB_ANSWERS=$ADMIN_HUB_ANSWERS
ADMIN_HUB_DROPS=$ADMIN_HUB_DROPS
ADMIN_HUB_SLOW=$ADMIN_HUB_SLOW
ADMIN_HUB_MAX_MTO=$ADMIN_HUB_MAX_MTO
ADMIN_HUB_MTO_SOURCE=$mto_source
ADMIN_HUB_VERDICT=$verdict
EOF

  rm -f "$tmp"
}

admin_alert_if_red() {
  if [[ "${ENABLE_ALERTS}" != "1" ]]; then
    return 0
  fi
  local metrics="$ROOT/scripts/admin-agent/logs/last-hub-metrics.env"
  [[ -f "$metrics" ]] || return 0
  # shellcheck source=/dev/null
  source "$metrics"
  case "${ADMIN_HUB_VERDICT:-}" in
    RED_*) ;;
    *) return 0 ;;
  esac

  local day alertf
  day="$(date +%F)"
  alertf="$ROOT/scripts/admin-agent/logs/alerts/RED-${day}.md"
  {
    echo "# RED alert — $day $(date -u +%H:%M:%SZ)"
    echo ""
    echo "- verdict: \`$ADMIN_HUB_VERDICT\`"
    echo "- matches=$ADMIN_HUB_MATCHES offers=$ADMIN_HUB_OFFERS answers=$ADMIN_HUB_ANSWERS"
    echo "- drops=$ADMIN_HUB_DROPS slow=$ADMIN_HUB_SLOW max_mto=$ADMIN_HUB_MAX_MTO"
    echo ""
    echo "See \`tasks/admin-queue/reports/${day}.md\`"
  } >"$alertf"

  admin_log "RED ALERT → $alertf"

  if command -v notify-send >/dev/null 2>&1; then
    notify-send -u critical "Ruletka RED" \
      "$ADMIN_HUB_VERDICT m=$ADMIN_HUB_MATCHES o=$ADMIN_HUB_OFFERS a=$ADMIN_HUB_ANSWERS" \
      2>/dev/null || true
  fi

  if [[ -n "${ALERT_WEBHOOK_URL}" ]]; then
    curl -fsS -X POST -H 'Content-Type: application/json' \
      -d "{\"text\":\"Ruletka RED: $ADMIN_HUB_VERDICT matches=$ADMIN_HUB_MATCHES offers=$ADMIN_HUB_OFFERS\"}" \
      "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
  fi

  {
    echo "## 🚨 RED alert fired"
    echo ""
    echo "- file: \`$alertf\`"
    echo "- verdict: \`$ADMIN_HUB_VERDICT\`"
  } | admin_report_append
}

admin_auto_enqueue() {
  if [[ "${ENABLE_AUTO_ENQUEUE}" != "1" ]]; then
    return 0
  fi
  local metrics="$ROOT/scripts/admin-agent/logs/last-hub-metrics.env"
  [[ -f "$metrics" ]] || return 0
  # shellcheck source=/dev/null
  source "$metrics"

  local day pending created=0
  day="$(date +%F)"
  pending="$ROOT/tasks/admin-queue/pending"

  if (( ADMIN_HUB_MATCHES > 0 && ADMIN_HUB_OFFERS == 0 )); then
    local f="$pending/005-auto-zero-offer-${day}.md"
    if [[ ! -f "$f" ]]; then
      cat >"$f" <<EOF
# AUTO: matches with zero offers (${day})

## Goal
Hub saw **${ADMIN_HUB_MATCHES} matches and 0 offers** in ${HUB_LOOKBACK_MIN}m.
Fix why startCall / kickSolo / browser offer is not firing.

## Scope
- \`ui/live.js\` (\`kickSoloWebRtc\`, \`handleMatched\`)
- \`ui/webrtc.js\` (\`connect\`, offer watchdog)
- \`mobile/src/media/MediaSession.ts\`, \`mobile/app/live.tsx\`
- \`docs/CONNECTIVITY_LOCK.md\`

## Done criteria
- Root cause + minimal fix or handoff
- Do **not** deploy
EOF
      admin_log "Auto-enqueued $f"
      created=1
    fi
  fi

  if (( ADMIN_HUB_SLOW > 0 || ADMIN_HUB_MAX_MTO > SLOW_OFFER_MS )); then
    local f="$pending/006-auto-slow-offer-${day}.md"
    # Skip if a connect-speed task is already queued (001-*, 002-*, 004-*)
    if [[ ! -f "$f" ]] \
      && ! compgen -G "$pending/001-*" >/dev/null \
      && ! compgen -G "$pending/002-*" >/dev/null \
      && ! compgen -G "$pending/004-*" >/dev/null
    then
      cat >"$f" <<EOF
# AUTO: slow match→offer (max ${ADMIN_HUB_MAX_MTO}ms)

## Goal
Target match_to_offer_ms < 2000 (see docs/CONNECTIVITY_LOCK.md).

## Scope
- Browser kickSolo / startPreview
- Mobile startCall fast path
- Hub web-vs-android offerer

## Done criteria
- Latency budget + small safe fix or checklist
- Do **not** deploy
EOF
      admin_log "Auto-enqueued $f"
      created=1
    else
      admin_log "Auto-enqueue skip slow-offer (connect P0 task already pending)"
    fi
  fi

  if (( ADMIN_HUB_DROPS > 2 && ADMIN_HUB_DROPS >= ADMIN_HUB_OFFERS )); then
    local f="$pending/007-auto-offer-thrash-${day}.md"
    if [[ ! -f "$f" ]]; then
      cat >"$f" <<EOF
# AUTO: offer debounce thrash (drops=$ADMIN_HUB_DROPS)

## Goal
Find second-offer source within 8s; keep single-offer lock.

## Scope
- MediaSession callGen / offerSent / watchdog
- webrtc.js double-offer guards
- Hub last_offer_at

## Done criteria
- Source identified + minimal fix
- Do **not** deploy
EOF
      admin_log "Auto-enqueued $f"
      created=1
    fi
  fi

  if (( created == 0 )); then
    admin_log "Auto-enqueue: no new tasks"
  fi
}

admin_pick_pending_task() {
  local f
  f="$(find "$ROOT/tasks/admin-queue/pending" -maxdepth 1 -type f -name '*.md' | sort | head -1 || true)"
  [[ -n "$f" ]] && echo "$f" || echo ""
}

# Create isolated branch worktree for Claude (does not dirty main)
admin_prepare_worktree() {
  local stamp="$1" slug="$2"
  local branch wt
  branch="admin/${stamp}-${slug}"
  # sanitize branch
  branch="$(echo "$branch" | tr -cd 'a-zA-Z0-9._/-' | cut -c1-80)"
  wt="$ROOT/.admin-worktrees/${stamp}-${slug}"

  if [[ "${ENABLE_BRANCH_ISOLATION}" != "1" ]]; then
    echo "$ROOT"
    return 0
  fi

  if ! command -v git >/dev/null 2>&1 || [[ ! -d "$ROOT/.git" ]]; then
    admin_log "No git — work on ROOT"
    echo "$ROOT"
    return 0
  fi

  # Remove stale worktree path if exists
  if [[ -d "$wt" ]]; then
    git -C "$ROOT" worktree remove --force "$wt" 2>/dev/null || rm -rf "$wt"
  fi
  # Drop existing branch name if leftover from prior failed run
  git -C "$ROOT" branch -D "$branch" 2>/dev/null || true

  # Quiet stdout: "HEAD is now at …" must not leak into callers using $(…)
  if git -C "$ROOT" worktree add -b "$branch" "$wt" HEAD \
      >"$ROOT/scripts/admin-agent/logs/worktree.err" 2>&1; then
    admin_log "Worktree ready branch=$branch path=$wt"
    echo "$branch" >"$wt/.admin-branch-name"
    printf '%s\n' "$wt"
  else
    admin_log "worktree failed — fall back to ROOT ($(tail -1 "$ROOT/scripts/admin-agent/logs/worktree.err" 2>/dev/null || true))"
    printf '%s\n' "$ROOT"
  fi
}

# Prints verify report to stdout. Exit 0 = hard checks passed, 1 = hard fail.
# Soft fails (tsc without mobile touch) are noted but non-fatal.
admin_verify_changes() {
  local work="$1"
  local report ok=0
  report="$(mktemp)"
  {
    echo "## Verify"
    echo ""
  } >"$report"

  # Geo unit test if present (hard)
  if [[ -f "$work/ui/geoLocalize.js" ]]; then
    if node <<NODE >>"$report" 2>&1
const fs=require("fs");
const vm=require("vm");
const code=fs.readFileSync("$work/ui/geoLocalize.js","utf8");
function run(lang){
  const ctx={Intl, localStorage:{getItem:()=>lang}, NextfaceI18n:{getLang:()=>lang}};
  ctx.window=ctx; ctx.globalThis=ctx; ctx.global=ctx;
  vm.runInNewContext(code, ctx);
  const G=ctx.RuletGeo||ctx.window.RuletGeo;
  return {c:G.localizeCountry("Canada","CA"), city:G.localizeCity("Calgary")};
}
const ru=run("ru");
const en=run("en");
if(ru.c!=="Канада"||ru.city!=="Калгари") { console.log("FAIL geo ru", ru); process.exit(1); }
if(en.c!=="Canada"||en.city!=="Calgary") { console.log("FAIL geo en", en); process.exit(1); }
console.log("PASS geoLocalize Canada/Calgary");
NODE
    then
      echo "- geoLocalize: **PASS**" >>"$report"
    else
      echo "- geoLocalize: **FAIL**" >>"$report"
      ok=1
    fi
  fi

  # Mobile tsc — only run (and hard-fail) if this worktree changed mobile/*
  if [[ "${ENABLE_VERIFY}" == "1" ]] && [[ -x "$work/mobile/node_modules/typescript/bin/tsc" || -x "$ROOT/mobile/node_modules/typescript/bin/tsc" ]]; then
    local tsc="$ROOT/mobile/node_modules/typescript/bin/tsc"
    local mobile_touched=0
    [[ -x "$work/mobile/node_modules/typescript/bin/tsc" ]] && tsc="$work/mobile/node_modules/typescript/bin/tsc"
    # Prefer diff vs merge-base with main so clean worktrees without commits still detect edits
    if git -C "$work" status --porcelain 2>/dev/null | grep -qE 'mobile/'; then
      mobile_touched=1
    elif git -C "$work" diff --name-only main...HEAD 2>/dev/null | grep -qE '(^|/)mobile/'; then
      mobile_touched=1
    fi
    if (( mobile_touched == 1 )); then
      if (cd "$work/mobile" && "$tsc" --noEmit --pretty false >>"$report" 2>&1); then
        echo "- tsc --noEmit: **PASS**" >>"$report"
      else
        echo "- tsc --noEmit: **FAIL**" >>"$report"
        ok=1
      fi
    else
      echo "- tsc --noEmit: skipped (no mobile/* changes)" >>"$report"
    fi
  fi

  # pair unit tests if present — hard when mobile scripts changed or always as soft smoke
  if [[ -f "$work/mobile/scripts/test-connect-ui.mjs" ]]; then
    if (cd "$work/mobile" && node scripts/test-connect-ui.mjs >>"$report" 2>&1); then
      echo "- test-connect-ui: **PASS**" >>"$report"
    else
      echo "- test-connect-ui: **FAIL**" >>"$report"
      ok=1
    fi
  fi

  # Completion promise in RESULT files (soft signal)
  if grep -Rql --include='*-RESULT.md' -E '^COMPLETE$|Completion promise.*COMPLETE' \
      "$ROOT/tasks/admin-queue/done" 2>/dev/null; then
    echo "- RESULT completion promise: seen recently" >>"$report"
  fi

  cat "$report"
  rm -f "$report"
  return "$ok"
}

# Commit on isolated admin branch only. Never push.
admin_auto_commit_worktree() {
  local work="$1" branch_note="$2" task_base="$3"
  if [[ "${ENABLE_AUTO_COMMIT}" != "1" ]]; then
    return 0
  fi
  if [[ "$work" == "$ROOT" ]]; then
    admin_log "auto-commit skip (working on ROOT — isolation off)"
    return 0
  fi
  if ! git -C "$work" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi
  # Only commit if dirty
  if [[ -z "$(git -C "$work" status --porcelain 2>/dev/null)" ]]; then
    admin_log "auto-commit: clean worktree"
    return 0
  fi
  (
    cd "$work"
    git add -A
    git -c user.email="${GIT_AUTHOR_EMAIL:-admin-agent@local}" \
        -c user.name="${GIT_AUTHOR_NAME:-ruletka-admin-agent}" \
        commit -m "admin: ${task_base}

Overnight agent on ${branch_note}. No push. Human merge after smoke." \
      --no-gpg-sign 2>/dev/null || true
  )
  admin_log "auto-commit on $branch_note: $(git -C "$work" log -1 --oneline 2>/dev/null || echo '?')"
}

# Build Claude prompt wrap for a task (+ optional Ralph retry feedback)
admin_build_claude_wrap() {
  local work="$1" branch_note="$2" stamp="$3" slug="$4" base="$5" task_run="$6" attempt="$7" feedback_file="${8:-}"
  local result_path feedback=""
  result_path="$ROOT/tasks/admin-queue/done/${stamp}-${slug}-RESULT.md"
  if [[ -n "$feedback_file" && -f "$feedback_file" ]]; then
    feedback="$(cat "$feedback_file")"
  fi
  cat <<EOF
$(cat "$ROOT/scripts/admin-agent/prompts/claude-wrapper.md")

---

# Isolated worktree (IMPORTANT)

- **Working directory:** \`$work\`
- **Git branch:** \`$branch_note\`
- **Attempt:** $attempt / ${RALPH_MAX_ATTEMPTS}
- Edit files **only under that directory** (not other worktrees).
- Do **not** merge to main, do **not** deploy, do **not** git push.
- When done write RESULT to:
  \`$result_path\`
  (absolute path on the host so morning review finds it)

# Task file: $base

$(cat "$task_run")
EOF
  if [[ -n "$feedback" ]]; then
    cat <<EOF

---

# RALPH RETRY — previous attempt failed verify

Fix **only** the failures below. Do not expand scope.

\`\`\`
$feedback
\`\`\`
EOF
  fi
}

# Run one Claude invocation; wait with timeout. Echoes exit code via global ADMIN_LAST_CLAUDE_EC.
admin_invoke_claude() {
  local work="$1" wrap_file="$2" log="$3" pid_file="$4"
  local cpid waited ec=0
  : >>"$log"
  (
    cd "$work"
    if command -v stdbuf >/dev/null 2>&1; then
      stdbuf -oL -eL claude -p "$(cat "$wrap_file")" \
        --output-format text \
        --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
        2>&1 | stdbuf -oL tee -a "$log"
    else
      claude -p "$(cat "$wrap_file")" \
        --output-format text \
        --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
        2>&1 | tee -a "$log"
    fi
  ) &
  cpid=$!
  echo "$cpid" >"$pid_file"
  admin_log "Claude PID=$cpid cwd=$work log=$log"

  waited=0
  while kill -0 "$cpid" 2>/dev/null; do
    if (( waited >= CLAUDE_TIMEOUT_SEC )); then
      admin_log "Claude timeout — kill $cpid"
      kill "$cpid" 2>/dev/null || true
      sleep 5
      kill -9 "$cpid" 2>/dev/null || true
      ADMIN_LAST_CLAUDE_EC=124
      return 124
    fi
    sleep 15
    waited=$((waited + 15))
  done
  wait "$cpid" || ec=$?
  ADMIN_LAST_CLAUDE_EC=$ec
  return 0
}

admin_run_claude_task() {
  local task_src="$1"
  local base stamp log pid_file wrap task_run dest work slug branch_note
  local attempt max_attempts verify_out verify_ec ec=0 final_ok=1
  base="$(basename "$task_src")"
  slug="${base%.md}"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  log="$ROOT/scripts/claude-logs/admin-${stamp}-${slug}.out"
  pid_file="$ROOT/scripts/claude-logs/admin-claude.pid"
  task_run="$ROOT/tasks/admin-queue/running/${stamp}-${base}"
  wrap="$(mktemp)"
  verify_out="$(mktemp)"
  : >"$log"

  mv "$task_src" "$task_run"
  admin_log "Claude task → running: $base"

  work="$(admin_prepare_worktree "$stamp" "$slug")"
  branch_note="main (no isolation)"
  if [[ -f "$work/.admin-branch-name" ]]; then
    branch_note="$(cat "$work/.admin-branch-name")"
  elif [[ "$work" != "$ROOT" ]]; then
    branch_note="worktree:$work"
  fi

  # Copy task into worktree for Claude to read
  mkdir -p "$work/tasks/admin-queue/running"
  cp "$task_run" "$work/tasks/admin-queue/running/"

  if ! command -v claude >/dev/null 2>&1; then
    admin_log "claude CLI not found"
    mv "$task_run" "$ROOT/tasks/admin-queue/failed/$base"
    rm -f "$wrap" "$verify_out"
    return 1
  fi

  max_attempts=1
  if [[ "${ENABLE_RALPH_RETRY}" == "1" ]]; then
    max_attempts="${RALPH_MAX_ATTEMPTS}"
  fi
  (( max_attempts < 1 )) && max_attempts=1

  attempt=1
  while (( attempt <= max_attempts )); do
    admin_log "Claude attempt $attempt/$max_attempts task=$base"
    if (( attempt == 1 )); then
      admin_build_claude_wrap "$work" "$branch_note" "$stamp" "$slug" "$base" "$task_run" "$attempt" \
        >"$wrap"
    else
      admin_build_claude_wrap "$work" "$branch_note" "$stamp" "$slug" "$base" "$task_run" "$attempt" "$verify_out" \
        >"$wrap"
    fi

    echo "" >>"$log"
    echo "===== attempt $attempt / $max_attempts =====" >>"$log"

    if ! admin_invoke_claude "$work" "$wrap" "$log" "$pid_file"; then
      ec="${ADMIN_LAST_CLAUDE_EC:-124}"
    else
      ec="${ADMIN_LAST_CLAUDE_EC:-0}"
    fi

    if (( ec == 124 )); then
      mv "$task_run" "$ROOT/tasks/admin-queue/failed/$base" 2>/dev/null || true
      {
        echo "## Claude TIMEOUT"
        echo "- task: \`$base\` branch: \`$branch_note\` attempt: $attempt"
        echo "- worktree: \`$work\`"
        echo "- log: \`$log\`"
        echo '```'
        tail -100 "$log" 2>/dev/null || true
        echo '```'
      } | admin_report_append
      rm -f "$wrap" "$verify_out" "$pid_file"
      return 1
    fi

    # Verify gate
    verify_ec=0
    if [[ "${ENABLE_VERIFY}" == "1" ]]; then
      set +e
      admin_verify_changes "$work" >"$verify_out" 2>&1
      verify_ec=$?
      set -e
    else
      echo "## Verify skipped" >"$verify_out"
    fi

    if (( verify_ec == 0 )); then
      final_ok=0
      admin_log "verify PASS attempt=$attempt"
      break
    fi

    admin_log "verify FAIL attempt=$attempt"
    if (( attempt >= max_attempts )); then
      final_ok=1
      break
    fi
    attempt=$((attempt + 1))
  done

  rate_limited=0
  if grep -qiE 'session limit|rate limit|usage limit|hit your limit' "$log" 2>/dev/null; then
    rate_limited=1
  fi

  # Auto-commit only when Claude actually ran (not rate-limited empty sessions)
  if (( rate_limited == 0 )); then
    admin_auto_commit_worktree "$work" "$branch_note" "$base" || true
  fi

  if (( rate_limited == 1 )); then
    # Put original name back in pending for a later cycle (do not burn the task)
    admin_log "rate-limit detected — requeue $base to pending; skip more Claude this cycle"
    admin_record_rate_limit_reset "$log" || true
    mv "$task_run" "$ROOT/tasks/admin-queue/pending/$base" 2>/dev/null || true
    # Signal run-once.sh to stop picking more tasks
    export ADMIN_CLAUDE_RATE_LIMITED=1
    echo "1" >"$ROOT/scripts/admin-agent/logs/rate-limited.flag"
  elif (( ec != 0 )); then
    mv "$task_run" "$ROOT/tasks/admin-queue/failed/$base" 2>/dev/null || true
  else
    # verify fail after retries still lands in done for morning review
    mv "$task_run" "$ROOT/tasks/admin-queue/done/$base" 2>/dev/null || true
    # Count real Claude work (exit 0, not rate-limited) toward mid-night judge
    admin_claude_success_count_inc >/dev/null || true
  fi

  {
    echo "## Claude finished (exit $ec, verify=$final_ok, attempts=$attempt)"
    echo ""
    echo "- task: \`$base\`"
    echo "- branch: \`$branch_note\`"
    echo "- worktree: \`$work\`"
    echo "- log: \`$log\`"
    echo "- ralph attempts: $attempt / $max_attempts"
    echo "- verify: $([[ $final_ok -eq 0 ]] && echo PASS || echo FAIL)"
    echo ""
    echo '```'
    tail -120 "$log" 2>/dev/null || echo "(empty)"
    echo '```'
    echo ""
    admin_git_snapshot "$work"
    echo ""
    cat "$verify_out" 2>/dev/null || true
    echo ""
    echo "### Morning merge (if good)"
    echo ""
    echo '```bash'
    if [[ "$work" != "$ROOT" && -f "$work/.admin-branch-name" ]]; then
      echo "cd $ROOT"
      echo "git log admin/$(basename "$(cat "$work/.admin-branch-name")" 2>/dev/null || true) --oneline -5 2>/dev/null || git -C $work log --oneline -5"
      echo "git -C $work diff main --stat"
      echo "git merge $(cat "$work/.admin-branch-name")"
    else
      echo "cd $ROOT && git status && git diff"
    fi
    echo '```'
  } | admin_report_append

  {
    echo "TASK=$base"
    echo "BRANCH=$branch_note"
    echo "WORKTREE=$work"
    echo "EXIT=$ec"
    echo "VERIFY=$final_ok"
    echo "ATTEMPTS=$attempt"
    echo "LOG=$log"
    echo "AT=$stamp"
  } >>"$ROOT/scripts/admin-agent/logs/last-claude-jobs.env"

  rm -f "$wrap" "$verify_out" "$pid_file"
  admin_log "Claude done exit=$ec verify=$final_ok attempts=$attempt branch=$branch_note"
  return 0
}

# Run Grok with a prompt file. mode: morning|judge|manager
admin_grok_run() {
  local mode="${1:-morning}"
  local prompt_file max_turns log stamp out_hint
  if [[ "${ENABLE_GROK}" != "1" ]]; then
    return 0
  fi
  if ! command -v grok >/dev/null 2>&1; then
    admin_log "grok CLI not found — skip ($mode)"
    return 0
  fi

  case "$mode" in
    judge)
      prompt_file="$ROOT/scripts/admin-agent/prompts/grok-judge.md"
      max_turns="${GROK_MAX_TURNS_JUDGE}"
      out_hint="JUDGE-LATEST.md"
      ;;
    manager)
      prompt_file="$ROOT/scripts/admin-agent/prompts/grok-manager.md"
      max_turns="${GROK_MAX_TURNS_MANAGER}"
      out_hint="MANAGER-LATEST.md"
      ;;
    morning|*)
      prompt_file="$ROOT/scripts/admin-agent/prompts/grok-review.md"
      max_turns="${GROK_MAX_TURNS_MORNING}"
      out_hint="MORNING-BRIEF.md"
      mode="morning"
      ;;
  esac

  if [[ ! -f "$prompt_file" ]]; then
    admin_log "missing prompt $prompt_file"
    return 1
  fi

  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  log="$ROOT/scripts/admin-agent/logs/grok-${mode}-${stamp}.out"
  local timeout_sec="${GROK_TIMEOUT_SEC:-900}"
  admin_log "Grok $mode → $log (max-turns=$max_turns timeout=${timeout_sec}s)"

  {
    echo "## Grok \`$mode\` start"
    echo ""
    echo "- prompt: \`$prompt_file\`"
    echo "- log: \`$log\`"
    echo "- timeout_sec: $timeout_sec"
  } | admin_report_append

  # Run to a log file first (do not pipe into report — tail blocks on long agents)
  : >"$log"
  (
    cd "$ROOT"
    if command -v timeout >/dev/null 2>&1; then
      timeout --signal=TERM --kill-after=30 "$timeout_sec" \
        grok -p "$(cat "$prompt_file")" \
          --cwd "$ROOT" \
          --max-turns "$max_turns" \
          2>&1 || true
    else
      grok -p "$(cat "$prompt_file")" \
        --cwd "$ROOT" \
        --max-turns "$max_turns" \
        2>&1 || true
    fi
  ) >>"$log" 2>&1 || true

  if [[ -f "$ROOT/tasks/admin-queue/reports/$out_hint" ]]; then
    admin_log "Grok $mode wrote $out_hint"
  else
    admin_log "Grok $mode finished (no $out_hint yet — see log)"
  fi
  {
    echo "## Grok \`$mode\` end"
    echo ""
    if [[ -f "$ROOT/tasks/admin-queue/reports/$out_hint" ]]; then
      echo "- wrote: \`tasks/admin-queue/reports/$out_hint\`"
      echo ""
      echo '```'
      head -60 "$ROOT/tasks/admin-queue/reports/$out_hint" 2>/dev/null || true
      echo '```'
    else
      echo "- no $out_hint; tail log:"
      echo '```'
      tail -40 "$log" 2>/dev/null || true
      echo '```'
    fi
  } | admin_report_append
}

admin_optional_grok() {
  # Morning full brief
  admin_grok_run morning
}

admin_grok_judge_if_due() {
  if [[ "${ENABLE_GROK}" != "1" || "${ENABLE_GROK_MIDNIGHT_JUDGE}" != "1" ]]; then
    return 0
  fi
  local n every
  n="$(admin_claude_success_count_get)"
  every="${GROK_JUDGE_EVERY_N_CLAUDE}"
  (( every < 1 )) && every=2
  if (( n >= every )); then
    admin_log "mid-night judge due (successes=$n >= $every)"
    admin_grok_run judge || true
    admin_claude_success_count_set 0
  else
    admin_log "mid-night judge not due (successes=$n / $every)"
  fi
}

admin_grok_manager_during_rate_limit() {
  if [[ "${ENABLE_GROK}" != "1" || "${ENABLE_GROK_DURING_RATE_LIMIT}" != "1" ]]; then
    return 0
  fi
  # At most one manager run per rate-limit window (flag file)
  local guard="$ROOT/scripts/admin-agent/logs/grok-manager-ran.flag"
  if [[ -f "$guard" ]]; then
    local age
    age=$(( $(date +%s) - $(stat -c %Y "$guard" 2>/dev/null || echo 0) ))
    # Re-run manager at most every 90 minutes while limited
    if (( age < 5400 )); then
      admin_log "Grok manager skipped (ran ${age}s ago)"
      return 0
    fi
  fi
  admin_log "Claude idle/rate-limited — Grok manager re-ranks queue"
  admin_grok_run manager || true
  date -u +%Y-%m-%dT%H:%M:%SZ >"$guard"
}

admin_queue_summary() {
  local p r d f
  p=$(find "$ROOT/tasks/admin-queue/pending" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
  r=$(find "$ROOT/tasks/admin-queue/running" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
  d=$(find "$ROOT/tasks/admin-queue/done" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
  f=$(find "$ROOT/tasks/admin-queue/failed" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
  echo "Queue: pending=$p running=$r done=$d failed=$f"
}

admin_list_overnight_branches() {
  git -C "$ROOT" branch --list 'admin/*' 2>/dev/null | sed 's/^/  /' || true
  if [[ -d "$ROOT/.admin-worktrees" ]]; then
    echo "Worktrees:"
    ls -1 "$ROOT/.admin-worktrees" 2>/dev/null | sed 's/^/  /' || true
  fi
}
