# RESULT: 052-hub-match-speed-answer-metrics

## Status
DONE

## Completion promise
COMPLETE

## What changed
- Added `scripts/hub-match-speed.sh`: read-only ops helper that SSHes the hub,
  greps `journalctl -u roulette-bridge`, and prints a summary table + verdict.
- Summary table now includes, in addition to the existing offer metrics:
  - `slow answers (>SLOW_ANSWER_MS)` and `max match_to_answer_ms` (env
    `SLOW_ANSWER_MS`, default 2000), with an `mta source` row that reads
    `none` when the field isn't in the log window (older logs).
  - `answerer first-path grace drops` count.
  - `android SLOW first-offers` count (`first offer after match SLOW.*platform=android`).
- Verdict logic: `FAIL` whenever `android SLOW first-offers > 0` (checked
  right after the `IDLE`/no-matches case, before any other rule). `WARN`
  when `match_to_answer_ms` is over budget, and a separate `WARN` when
  `answers < offers`. Falls back to `IDLE`/`PASS`/other existing rules
  unchanged otherwise.
- No server code touched (read-only `journalctl` grep over SSH only).

## Note on duplicate work found in main
The main working tree (`/home/drakosik/freenet-roulette`, **not** this
worktree) already has an untracked `scripts/hub-match-speed.sh` +
`scripts/smoke-connect.sh` that appear to implement this same task (and
more — also a `match_to_ice_ms` metric from a later task), attributed to a
"Grok polish pass" per `tasks/admin-queue/done/052-hub-match-speed-answer-metrics-RESULT.md`.
Those files are uncommitted/untracked in main, so they were not visible in
this isolated worktree. I independently implemented and verified this
task's success criteria here (see Verify ran below) rather than blindly
copying, but the logic ended up nearly identical since both satisfy the
same spec. **Morning reviewer: reconcile before merging** — either merge
this branch's `scripts/hub-match-speed.sh` and have Grok's uncommitted
main copy overwritten/discarded, or keep Grok's version (which additionally
has `match_to_ice_ms`) and drop this commit. Do not end up with two
diverging versions long-term.

## Files
- scripts/hub-match-speed.sh (new)

## Verify ran
- `bash -n scripts/hub-match-speed.sh` — syntax OK.
- Ran the script against synthetic `journalctl`-style fixtures via a stub
  `ssh` on `PATH` (no real network/hub access used):
  - Old-format fixture (only `match_to_offer_ms`, no answer fields) →
    table renders with `mta source: none`, verdict `PASS`.
  - Fixture with `first offer after match SLOW ... platform=android` +
    `answerer first-path grace drop` + `match_to_answer_ms=4000` → table
    shows `android SLOW first-offers=1`, `grace drops=1`,
    `max match_to_answer_ms=4000`, verdict `FAIL` (android SLOW rule wins).
  - Fixture with 2 offers / 1 answer → verdict `WARN`, reason
    "answers (1) < offers (2)".
  - No `SSH_KEY` present → prints `FAIL: no SSH key at ...` and exits 0
    (never throws / never touches prod).

## Connect risk
safe to merge after smoke — this is a read-only ops/forensics script, no
app or bridge code touched.

## Handoff for morning
- merge branch: `admin/20260809T072230Z-052-hub-match-speed-answer-metrics`
- **First reconcile with the duplicate, uncommitted `scripts/hub-match-speed.sh`
  already sitting in the main working tree** (see note above) before merging,
  to avoid clobbering Grok's newer `match_to_ice_ms` addition.
- smoke: run `./scripts/hub-match-speed.sh 15` against the real hub after a
  manual Play↔PC pair to confirm live output matches the fixtures tested here.
- do not: deploy without Play↔PC check.
