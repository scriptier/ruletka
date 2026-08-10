# RESULT: 051-device-smoke-189-baseline

## Status
DONE

## Completion promise
COMPLETE

## What changed
- `docs/DEVICE_SMOKE.md`: refreshed Play↔PC connect smoke section to match the working connect path —
  - Manual steps now explicitly say **Start once, don't spam Next**, **15s no-Next-spam**, and **fast cams expected**.
  - Added a note to watch the connect stopwatch toast `CONNECT offer=…ms answer=…ms frame=…ms` (actual string found at `mobile/src/media/MediaSession.ts` — the task described it as `Link offer=… frame=…`, but the real toast text is prefixed `CONNECT`, not `Link`; documented the accurate string).
  - Added explicit step to confirm `force_relay` web↔android and **exactly 1 offer + 1 answer** via hub asserts.
  - Added `./scripts/smoke-connect.sh --hub-only` as the after-smoke step (both in the manual steps list and in the hub-asserts command block).
  - Added `UI_ONLY=1 ./scripts/deploy/push.sh` as a documented UI-only iterate shortcut in the "Current binary" table.

## Version note (important — read before merge)
Task success criteria named **0.1.189 / vc197** but allowed falling back to "current `mobile/app.json` if bumped." Checked `mobile/app.json` in this worktree (based on latest `main`, commit `b502154`): version is **0.1.136 / versionCode 144**, and `docs/DEVICE_SMOKE.md` / `docs/PLAY_INTERNAL_TEST_CHECKLIST.md` already state that version correctly — no version bump has landed to 0.1.189/vc197 yet on `main`. Left the version line as **0.1.136 / vc144** since that's the true current baseline; did not fabricate a 0.1.189/vc197 line that doesn't match `app.json`. `docs/PLAY_INTERNAL_TEST_CHECKLIST.md` version line was already correct (0.1.136/144) — no edit needed there.

## Observation for Grok (not acted on, out of scope)
The main repo working tree (`/home/drakosik/freenet-roulette`, not this worktree) currently has several **uncommitted** modified files (`mobile/src/media/MediaSession.ts`, `mobile/app/live.tsx`, `docs/CONNECTIVITY_LOCK.md`, `docs/DEVICE_SMOKE.md`, etc.) plus untracked scripts (`scripts/hub-match-speed.sh`, `scripts/smoke-connect.sh`, `scripts/pair-smoke.mjs`, `scripts/admin-agent/run-once.sh`) that are **not yet committed to `main`**, so they don't exist in this isolated worktree's checked-out tree. This is where the `CONNECT offer=/answer=/frame=` toast string actually lives (already implemented, just uncommitted). Once that work lands on `main`, the scripts/toast referenced in this doc update will be present for real testers to run — right now they only exist in the uncommitted main working tree, not in git history or this worktree.

## Files
- docs/DEVICE_SMOKE.md

## Verify ran
- Read `mobile/app.json` (version/versionCode) to confirm baseline.
- Grepped repo (this worktree + main working tree) for `Link offer=`, `CONNECT offer=`, `UI_ONLY`, `smoke-connect.sh`, `hub-match-speed.sh` to ground doc claims in real strings/scripts rather than the task's paraphrase.
- `git diff -- docs/DEVICE_SMOKE.md` reviewed — doc-only, minimal diff.
- No code touched; no tsc/build needed (docs-only task).

## Connect risk
safe to merge after smoke

## Handoff for morning
- merge branch: `admin/20260809T063842Z-051-device-smoke-189-baseline`
- smoke: none required (docs-only change), but worth a real Play↔PC smoke once the uncommitted `main` WIP (CONNECT toast, smoke-connect.sh, hub-match-speed.sh) is committed, so the new doc steps are runnable verbatim.
- do not: deploy without Play↔PC check; do not assume 0.1.189/vc197 — current baseline is still 0.1.136/vc144 on `main`.
