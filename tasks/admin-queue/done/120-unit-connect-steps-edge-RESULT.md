# 120-unit-connect-steps-edge — RESULT

**Status:** COMPLETE

## What changed
Added 2 edge-case assertions to `mobile/src/live/connectSteps.test.mjs`:
- `phase: "error"` → stage `"idle"` (error phase collapses to idle, same as untested `idle` branch's sibling condition).
- `phase: "matched"`, `conn: "completed"` (not `"connected"`), `hasRemoteVideo: false`, `awaitingRemoteVideo: true` → stage `"wait_video"` (exercises the `conn === "completed"` arm of the `mediaUp` check, which previously had no direct coverage).

## Files touched
- `mobile/src/live/connectSteps.test.mjs`

## Verify commands run
- `node src/live/connectSteps.test.mjs` → `connectSteps.test.mjs ok`
- `./scripts/dev-smoke.sh --unit` → `=== dev-smoke PASS (unit only) ===` (all unit suites green)

## Connect risk
none — test-only change, no production code touched.

COMPLETE
