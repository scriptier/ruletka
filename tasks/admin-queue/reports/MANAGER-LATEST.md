# MANAGER-LATEST — pre-Claude window (2026-08-07)

## Hub
- **YELLOW_slow** — offers≈answers, max MTO ~25s (timestamp delta), drops present
- Priority: **connect P0 only** until hub-match-speed improves

## Ordered work for Claude (after ~06:30)

| Order | File | Focus |
|------:|------|--------|
| 1 | `001-connect-slow-offer.md` | match→offer &lt; 2s |
| 2 | `002-mobile-answer-path.md` | Play as answerer |
| 3 | `003-offer-thrash.md` | second-offer debounce |
| 4 | `004-web-kicksolo-speed.md` | browser warm path |
| 5 | `020-cam-mute-parity.md` | mute/hide parity |
| 6 | `022-background-keepalive-reconnect.md` | bg recover banner |
| 7 | `023-friend-call-ring-parity.md` | friend ring/miss |
| 8 | `024-web-friend-call-notify.md` | tab unfocused alert |
| 9 | `033-chat-gifts-parity-audit.md` | gifts/chat gaps only |
| 10 | `035-geo-city-map-expand.md` | RU cities |
| 11 | `036-play-store-checklist-docs.md` | docs checklist |
| 12 | `090-open-on-pc-qr-design.md` | design only |

## Queue changes this manager pass
- Renamed P1 for filename order: `022` bg, `023` ring, `024` web notify
- **Blocked** `034-prefer-direct` → `tasks/admin-queue/blocked/` (ICE risk overnight)
- Connect auto-enqueue skipped while 001/002/004 exist

## Morning human
1. `./scripts/admin-agent/morning.sh`
2. `./scripts/hub-match-speed.sh 30`
3. Smoke Play↔PC; merge only `admin/*` with connect risk **smoke-ok**
4. Disaster: `./scripts/admin-agent/restore-pre-sleep.sh`
