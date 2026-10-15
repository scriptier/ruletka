#!/usr/bin/env bash
# Auto-enqueue more Claude backlog tasks when the queue is thin.
# Called by continuous (optional) or Grok scheduler / human.
#
# Usage:
#   ./scripts/agents/auto-enqueue-backlog.sh
#   MIN_QUEUE=2 ./scripts/agents/auto-enqueue-backlog.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=lib.sh
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"
agents_load

MIN_QUEUE="${MIN_QUEUE:-2}"
pending_n=$(find "$PENDING" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
backlog_n=$(find "$QUEUE/backlog" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l)
total=$((pending_n + backlog_n))

echo "queue pending=$pending_n backlog=$backlog_n total=$total min=$MIN_QUEUE"
if (( total >= MIN_QUEUE )); then
  echo "queue OK — no auto-enqueue"
  exit 0
fi

# Next free 4xx number (include running; avoid ls+pipefail false-negative on missing globs)
n=410
while compgen -G "$PENDING/${n}-*.md" >/dev/null \
   || compgen -G "$QUEUE/backlog/${n}-*.md" >/dev/null \
   || compgen -G "$QUEUE/running/${n}-*.md" >/dev/null \
   || compgen -G "$DONE/${n}-*.md" >/dev/null; do
  n=$((n + 1))
done
num=$(printf '%03d' "$n")
mkdir -p "$QUEUE/backlog"

# Rotate through polish templates (non-overlapping OWN)
# Pick by hour so successive refills diversify
pick=$(( $(date +%H) % 5 ))
case $pick in
  0)
    slug="mobile-unit-identity-tests"
    body="# Mobile identity unit polish

## Goal
Add/extend unit tests for poison display names / displayPartnerStars without MediaSession thrash.

## OWN
- mobile/src/live/matchPeers.ts (read + tiny pure export only if needed)
- mobile/src/live/*.test.mjs or new pure test under mobile/src/identity/

## Done criteria
- [ ] node test exits 0
- [ ] RESULT + COMPLETE
- [ ] No APK/deploy

## Must not
- MediaSession rewrite, ICE, deploy
"
    ;;
  1)
    slug="live-stage-css-a11y-polish"
    body="# live-stage CSS a11y contrast for partner name

## Goal
Ensure #remote-name readable on dark video during trio hunt (text-shadow/z-index only).

## OWN
- ui/live-stage.css
- ui/live.html (css ?v= bump only)

## Done criteria
- [ ] Name chip contrast polish during stage-trio-searching
- [ ] Bump live-stage.css?v=
- [ ] RESULT + COMPLETE
- [ ] No live.js / deploy

## Must not
- Deploy, live.js, webrtc.js
"
    ;;
  2)
    slug="i18n-trio-looking-fill"
    body="# i18n fill trio.searching / slotEmpty across packs

## Goal
Ensure trio.searching and trio.slotEmpty exist in all ui/i18n/*.json packs (not just EN).

## OWN
- ui/i18n/*.json only

## Done criteria
- [ ] Keys present in en,ru,uk,de,es,fr at minimum
- [ ] RESULT + COMPLETE
- [ ] No deploy

## Must not
- MediaSession, APK
"
    ;;
  3)
    slug="friends-screen-lint-soft"
    body="# Friends screen soft polish (avatars already shipped)

## Goal
Small UX polish on friends list empty/error states only if obvious; otherwise document N/A in RESULT.

## OWN
- mobile/app/friends.tsx only

## Done criteria
- [ ] Minimal or Status: N/A if already good
- [ ] RESULT + COMPLETE
- [ ] No APK

## Must not
- live.tsx MediaSession thrash
"
    ;;
  4)
    slug="dev-smoke-unit-run"
    body="# Run mobile unit smoke and fix one broken test if any

## Goal
Run node mobile unit tests / scripts/dev-smoke unit path; fix one failing test only if cheap.

## OWN
- mobile/src/**/*.test.mjs (fix only)
- mobile/scripts/* only if test harness needs it

## Done criteria
- [ ] Tests pass or RESULT BLOCKED with log
- [ ] RESULT + COMPLETE
- [ ] No APK

## Must not
- Deploy, ICE thrash
"
    ;;
esac

out="$QUEUE/backlog/${num}-${slug}.md"
cat >"$out" <<EOF
$body

## Factory
Auto-enqueued $(date -u +%Y-%m-%dT%H:%M:%SZ) by auto-enqueue-backlog.sh
When done: RESULT in tasks/admin-queue/done/${num}-${slug}-RESULT.md with COMPLETE
EOF
echo "auto-enqueued: $out"
ls -la "$out"
