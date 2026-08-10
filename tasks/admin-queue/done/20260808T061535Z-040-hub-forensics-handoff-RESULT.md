# RESULT: 040-hub-forensics-handoff

## Status
DONE

## Completion promise
COMPLETE

## Hub verdict
**GREEN**

| metric | value |
|---|---:|
| matches | 4 |
| offers | 5 |
| answers | 4 |
| offer drops | 0 |
| slow offers (>15000ms configured threshold) | 0 |
| max match_to_offer_ms | 5268 |
| mto source | hub_field |

Source: `scripts/admin-agent/logs/last-hub-metrics.env` (refreshed 2026-08-08T06:15:35Z,
same second the forensics-only pass for this cycle ran — this is the current-cycle snapshot,
not stale). Cross-checked against the raw bridge log block in
`tasks/admin-queue/reports/2026-08-08.md` and verdict logic in `scripts/admin-agent/lib.sh:279-361`.

Note: `scripts/admin-agent/config.env` has `SLOW_OFFER_MS=15000` (not the `5000` in
`config.env.example`) — one match this cycle logged a bridge-side `WARN ... SLOW
match_to_offer_ms=5268`, but 5268 < 15000 so it does not count toward `ADMIN_HUB_SLOW` and
does not flip the verdict.

## Recommendation
**No code change.** matches=4 and offers=5 (offers > 0), so this does not meet the task's
RED trigger (matches>0 and offers=0). All 4 matches produced an offer; all offers got an
answer; 0 drops. The single 5.3s first-offer event is within configured tolerance and
consistent with the known, accepted residual `YELLOW_slow` behavior noted in
`docs/CONNECTIVITY_LOCK.md`. Connect/WebRTC code was **not** touched.

## What changed
- Added `tasks/admin-queue/reports/FORENSICS-HANDOFF.md` (in this worktree) summarizing the
  above, with source citations.
- No other files touched. No code, no config, no docs edited.

## Files
- tasks/admin-queue/reports/FORENSICS-HANDOFF.md (new, worktree-local)

## Verify ran
- Read `scripts/admin-agent/logs/last-hub-metrics.env` directly (forensics already run by
  the nightly cycle at cycle start, same timestamp as this task's assignment — did not
  re-run `run-once.sh --forensics-only` since fresh data already existed).
- Read `scripts/admin-agent/lib.sh` verdict logic to confirm GREEN classification and the
  RED_zero_offers / YELLOW_slow thresholds.
- Read `scripts/admin-agent/config.env` to confirm `SLOW_OFFER_MS=15000` and
  `HUB_LOOKBACK_MIN=90` in effect (not the example defaults).
- Read raw hub log block for this cycle from `tasks/admin-queue/reports/2026-08-08.md`.
- `git status --short` in worktree: confirms only the new report file was added, no
  connect/WebRTC or other code files touched.

## Connect risk
safe to merge after smoke (read-only task; no connect/WebRTC code changed)

## Handoff for morning
- merge branch: `admin/20260808T061535Z-040-hub-forensics-handoff` (adds one doc file only,
  trivial to merge or just cherry-pick the note manually — no functional risk)
- smoke: not required for this task (no code changed); normal Play↔PC smoke still applies
  before merging any *other* branches from tonight's queue
- do not: deploy without Play↔PC check (unrelated to this task, standing rule)
- hub is healthy (GREEN) as of 06:15Z — no forensics-driven follow-up task needed right now
