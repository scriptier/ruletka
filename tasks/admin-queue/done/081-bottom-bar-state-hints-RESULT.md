# 081 — LiveBottomBar state a11y

## Status
COMPLETE

## What changed
Audited `mobile/src/live/LiveBottomBar.tsx` against the done criteria (mute/cam/blur/next expose `accessibilityState` selected/disabled, labels sourced from `props.labels`).

Findings: cam, blur, and next controls already exposed correct `accessibilityState` (`selected`/`disabled`) and pulled labels from `L.*` props. The one gap was the mic (mute) button — it exposed `selected` but not `disabled`, even though `toggleMic()` in `live.tsx` is a no-op (with a status flash) while `debateMicLockedRef` is set, i.e. when `micForcedOff` is true. Added `disabled: micForcedOff` alongside the existing `selected` state so screen readers surface the locked state consistently with how the Next button already signals its grace/stay lock via `disabled`.

## Files touched
- `mobile/src/live/LiveBottomBar.tsx` (mic button `accessibilityState` now `{ selected, disabled }`)

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — pre-existing unrelated errors only (missing `expo-clipboard`/`expo-keep-awake` types, `MediaSession.ts` `iceGatheringState`, etc.); zero errors in `LiveBottomBar.tsx`.

## Connect risk
none — UI-only accessibility metadata change in the bottom bar component; no changes to `live.tsx` connect logic, MediaSession, or deploy.

COMPLETE
