# RESULT: 053-pair-smoke-connect-budget

## Status
DONE

## Completion promise
COMPLETE

## What changed
- `scripts/pair-smoke.mjs` did not exist in this isolated worktree's git
  history — it is untracked (never committed) in the main repo's working
  tree. Pulled the current copy in as the edit base so the change has a
  real commit, then layered the task's diff on top:
  - After a match **PASS** (match1 and, if it runs, match2), logs hub
    `match_to_offer_ms` against a new tighter **soft** budget
    `PAIR_SMOKE_MTO_ASSERT_MS` (default 2000ms). This is in addition to
    the existing hard `PAIR_SMOKE_MTO_MS` gate (default 3000ms) that
    already fails the run — the new check is informational only, per the
    task's "already partial" note, and never flips exit code.
  - If the page exposes `window.__ruletConnect` (client-measured connect
    timings), logs `offerMs`/`answerMs`/`trackMs` per bot after PASS.
  - Soft budget on `__ruletConnect.trackMs`: warns (does not fail) when
    `>= PAIR_SMOKE_TRACK_MS` (default 8000ms, env-overridable).
  - Warnings collect into `score.warnings` and are echoed in the final
    `[pair-smoke] SCORECARD` JSON line; exit code / hard PASS gate logic
    is untouched.
  - Wire-only offer/answer counting (`wsOut`, via `wireOffers`/
    `wireAnswers`) is unchanged — no `localSdp` warm noise added to any
    assertion.
  - One-liner added to the script header docblock describing the new
    post-PASS soft-assert behavior, plus the two new env vars documented
    alongside the existing budget list.

## Files
- scripts/pair-smoke.mjs (new commit on this branch; see note below)

## Verify ran
- `node --check scripts/pair-smoke.mjs` — syntax OK
- `node scripts/pair-smoke.mjs` in this worktree — SKIPs cleanly
  (`bridge binary missing`, expected: this worktree has no
  `target/release/roulette-bridge` build; building Rust was out of scope)
- Isolated unit test of the new `reportConnectBudgets` logic against
  mock `page.evaluate` (no `__ruletConnect`, over-budget MTO +
  over-budget trackMs, and a throwing `evaluate()` for a closed page) —
  all three cases logged and warned as expected, no crash.
- Did **not** run a full live pair-smoke pass (would need
  `cargo build -p freenet-roulette-bridge --release` + puppeteer-core,
  both unavailable/out of scope in this isolated worktree).

## Connect risk
hold — not because of this change (it's read-only telemetry/logging on
top of the existing gates), but because of the file-provenance issue
below. No app connect logic was touched.

## Handoff for morning
- **Important — reconcile before merging:** `scripts/pair-smoke.mjs` has
  never been committed to git; the main repo's working tree has its own
  (possibly further-evolved, e.g. from concurrent task 052) uncommitted
  copy at `/home/drakosik/freenet-roulette/scripts/pair-smoke.mjs`. This
  branch's commit is based on that file as it stood when this task
  started. Diff the two before merging/overwriting — do not blindly
  `cp`/overwrite the main repo's live copy.
- Also note: `window.__ruletConnect` (offerMs/answerMs/trackMs/iceMs/
  frameMs) is likewise only present in the main repo's **uncommitted**
  `ui/live.js` / `ui/webrtc.js` changes, not in any git history reachable
  from this branch. The new pair-smoke logic handles its absence
  gracefully (skips the log block), so this task doesn't depend on those
  files being committed — but the two features (this script's assertions
  and the app's `__ruletConnect` instrumentation) should land together to
  actually see the new log lines fire.
- merge branch: `admin/20260809T072515Z-053-pair-smoke-connect-budget`
  (commit `5ca476a`)
- smoke: build the bridge (`cargo build -p freenet-roulette-bridge
  --release`), ensure `puppeteer-core` is installed, then run
  `node scripts/pair-smoke.mjs` against the reconciled file and confirm
  the new `[pair-smoke] SCORECARD` line includes a `warnings` array and,
  when `__ruletConnect` is present, per-bot `offerMs/answerMs/trackMs`
  log lines after each PASS.
- do not: deploy without Play↔PC check
