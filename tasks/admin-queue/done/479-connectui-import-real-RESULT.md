# 479 — Import real connectUi in unit tests — RESULT

## Status
COMPLETE — GOAL_MET

## What changed
Both test files now transpile and import the **real** `mobile/src/media/connectUi.ts`
(same on-the-fly `typescript.transpileModule` pattern as `mobile/scripts/test-geo-localize.mjs`)
instead of maintaining hand-copied mirrors of `nextAutoRetryAction` / `computeConnSlow` /
`computeShowHardRetry`.

- `mobile/src/media/connectUi.test.mjs`: dropped the local `nextAutoRetryAction` reimplementation;
  now imports it from the transpiled real module. LOCK assertions unchanged (no soft@10s; soft@16s,
  hard@26s, tip@36s).
- `mobile/scripts/test-connect-ui.mjs`: dropped local reimplementations of `computeConnSlow`,
  `nextAutoRetryAction`, `computeShowHardRetry`; now imports all three from the transpiled real
  module. Updated the auto-retry assertions from the stale 10s/18s/28s schedule to the real locked
  schedule (soft ≥16s, hard ≥26s, tip ≥36s) — the old copy had drifted out of sync with
  `connectUi.ts` and no longer matched CONNECTIVITY_LOCK. Added an explicit "no soft@10s" assertion.
  `computeConnSlow` / `computeShowHardRetry` assertions were re-verified against the real function
  bodies and needed no value changes (same behavior at the tested timestamps despite the real
  module's different `slowMs` default).

`connectUi.ts` itself was **not modified** — behavior/schedule untouched, only the tests now exercise
it directly instead of a copy.

`mobile/src/media/mediasessionMultiSafety.test.mjs` was left untouched: the optional ask was to
assert `attachLocalTracksFireAndForget` is *absent*, but it is a real, currently-used private method
in `MediaSession.ts` (line 3422, sync wrapper for ICE-handler call sites that can't await). Adding an
absence assertion would fail against current, correct code, and this task is not scoped to touch
`MediaSession.ts` behavior — skipped rather than guess at intent.

Note: a prior RESULT file at this path claimed this work was already done, but the actual test files
on disk still contained the stale mirrors (verified by running them before editing — output lacked
"real module"). That RESULT was inaccurate/stale; this run performed and verified the actual import.

## Files touched
- `mobile/src/media/connectUi.test.mjs`
- `mobile/scripts/test-connect-ui.mjs`

## Verify commands run
- `node mobile/src/media/connectUi.test.mjs` → `connectUi.test.mjs OK (connectivity lock auto-retry, real module)` (exit 0)
- `node mobile/scripts/test-connect-ui.mjs` → `test-connect-ui: ok (real module)` (exit 0)
- `node mobile/src/media/mediasessionMultiSafety.test.mjs` → `mediasessionMultiSafety.test.mjs: ok` (exit 0, unchanged file, re-run for sanity)

## Connect risk
none — test-only diff, no `connectUi.ts` / `MediaSession.ts` / ICE / SDP / offer changes.

## Herd artifact path
`artifacts/herd/20260814T020528Z/lanes/tests.md` does not exist in this worktree — per task
instructions, GOAL_MET is recorded here instead.

COMPLETE
