# Task: Hub forensics handoff (read-only)

## Goal
Produce a morning-ready hub health note from current metrics. **Do not change connect/WebRTC code** unless verdict is RED (matches>0 and offers=0).

## Context
- Connect path is **LOCKED** (`docs/CONNECTIVITY_LOCK.md`). User is happy with cameras; residual YELLOW_slow is known.
- Baseline APK **0.1.148**. Overnight focus is Play UX polish, not offer thrash.

## Scope (only these)
- `scripts/admin-agent/` forensics outputs (read)
- `tasks/admin-queue/reports/` write `FORENSICS-HANDOFF.md` or RESULT only
- Optional: update a short section in RESULT with `ADMIN_HUB_*` from last-hub-metrics.env

## Done criteria
- [ ] RESULT with hub verdict, matches/offers/answers/drops, max MTO, source
- [ ] Explicit recommendation: **no code change** | **RED needs fix** (only if zero offers)
- [ ] No production deploy, no push, no CONNECTIVITY_LOCK undo
- [ ] RESULT contains **COMPLETE** when criteria met

## Completion promise
When done criteria are met, put the word `COMPLETE` in the RESULT under **Completion promise**.

## Do not
- Edit `ui/webrtc.js`, `ui/live.js` offer path, MediaSession offer lock
- Deploy / push / merge main
- Force_relay always-on / docker coturn

## Verify hints
- `./scripts/admin-agent/run-once.sh --forensics-only` (if already run by agent, just read logs)
- `cat scripts/admin-agent/logs/last-hub-metrics.env`
