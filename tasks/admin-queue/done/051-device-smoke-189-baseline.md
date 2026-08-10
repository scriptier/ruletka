# Task: DEVICE_SMOKE refresh for 0.1.189 baseline

## Owner
**Claude Code**

## Success
- `docs/DEVICE_SMOKE.md` version = **0.1.189 / vc197** (or current `mobile/app.json` if bumped)
- Smoke checklist matches working connect path:
  - both Start once, no Next spam 15s
  - hub: force_relay web↔android, 1 offer + 1 answer
  - expect fast cams; note toast `Link offer=… frame=…`
  - `./scripts/smoke-connect.sh --hub-only` after smoke
- Mention `UI_ONLY=1 ./scripts/deploy/push.sh` for UI-only iterates
- No code changes required unless docs only

## Files
- `docs/DEVICE_SMOKE.md`
- Optionally `docs/PLAY_INTERNAL_TEST_CHECKLIST.md` version line only

## Do not
- Touch media / hub / deploy scripts that change connect behavior
- Build APK

## Done
RESULT with **COMPLETE** under `tasks/admin-queue/done/`
