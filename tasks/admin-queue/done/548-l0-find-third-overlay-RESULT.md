# 548 — L0 Find-3rd invite overlay on Android

## Status
COMPLETE

## What changed
Added one L0 block to `mobile/scripts/verify-match-ux.mjs` that asserts the
Find-3rd invite overlay is a real Accept/Decline UI, not toast-only:

- `HubProvider.tsx` carries `findThirdIncoming` state populated from the
  `find_third_incoming` server message, and `HubClient.ts` exposes
  `findThirdRespond(accept: boolean)`.
- `_layout.tsx` renders the `findThirdIncoming && !incomingCall` block as a
  `<Pressable>`-based scrim/card (not `Alert.alert` / `ToastAndroid`), with
  Decline calling `hub.findThirdRespond(false)` and Accept calling
  `hub.findThirdRespond(true)`.

Checked `_layout.tsx`'s `incomingScrim` style: `zIndex: 400`, `elevation: 40`
— already ≥ 200 as intended, so per task scope (optional edit only if
zIndex < 200) `_layout.tsx` was left untouched.

## Files touched
- `mobile/scripts/verify-match-ux.mjs` (one new L0 block, ~35 lines, appended
  before the final summary/exit)

## Verify commands run
- `node scripts/verify-match-ux.mjs` — `L0 done: 114 ok, 0 fail`
  (new check: `HubProvider find_third_incoming state + HubClient
  findThirdRespond` — OK; `live.tsx/_layout find-3rd overlay is real
  Accept/Decline UI, not toast-only` — OK)

## Connect risk
none — no MediaSession/live.js/webrtc.js/ICE/TURN touched; static L0 script
only.

COMPLETE
