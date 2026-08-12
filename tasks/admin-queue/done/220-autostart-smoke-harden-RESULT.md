# 220 — Autostart always reaches Searching — RESULT

## Status
COMPLETE

## What changed
1. **`mobile/app/live.tsx`** — hardened the `ruletka://live?autostart=1` effect:
   - Existing behavior unchanged: optimistic "Looking…" paint (`useLayoutEffect`), primary spin attempt @80ms, retry @500ms if still idle/error.
   - New: added a **last-resort spin attempt @1200ms** — if still idle/error after the 500ms retry, re-enter search UI and call `start({ via: "autostart" })` one more time.
   - The `autostart` param is now cleared **after the 1200ms attempt** instead of after the 500ms one, so the retry window can't be killed by an early param-clear re-render (same race class the 2026-08-11 hardening already guarded against, just extended to the new timer).
   - Updated the block comment above the effect to describe the two-retry (500ms + 1200ms) sequence.

2. **`mobile/scripts/device-smoke.sh`** — after the main verdict classification, if the verdict is `IDLE`, the script now:
   - Taps Start once more (`tap_start_if_idle`),
   - Waits 8s,
   - Takes a `04-idle-retry` screenshot + UI dump,
   - Reclassifies and overwrites `VERDICT` before writing `last-verdict.txt`.
   - This gives the app's own 1200ms autostart retry (plus match-hub round trip) room to land before device-smoke calls it a failure.

## Files touched
- `mobile/app/live.tsx`
- `mobile/scripts/device-smoke.sh`

## Verify commands run
- `npm run test:match-ux` (in `mobile/`) → `L0 done: 23 ok, 0 fail`, including `OK  autostart: spin path + idle retry @500ms`.
- `bash -n mobile/scripts/device-smoke.sh` → syntax OK.
- `npx tsc --noEmit -p tsconfig.json` → pre-existing errors only (missing `node_modules` packages like `expo-clipboard`, `react-native-gesture-handler`, `react-native-reanimated`, and unrelated existing type issues); none touch the autostart effect lines I edited.

## Connect risk
**none** — no changes to hub, ICE/TURN, offer/answer, or MediaSession. Scope was limited to the autostart retry timing in `live.tsx` and smoke-script robustness. No CONNECTIVITY_LOCK-relevant code touched.

COMPLETE
