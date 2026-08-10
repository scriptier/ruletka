# Task 145: hubLobby unit edge case

## Status
COMPLETE

## Audit
`reduceStatusMsg` / `reduceLobbyInfoMsg` in `mobile/src/live/hubLobby.ts` derived
`online`/`waiting` counts with `Number(m.online || 0)`. That pattern only guards
`0`/`undefined`/`null`; a malformed field from the hub (e.g. a non-numeric string)
produced `NaN`, and a negative field (e.g. `waiting_peers: -3`, possible from a hub
race) passed straight through uncl amped. Both flow into user-facing text
(`mobile.live.meta`, `mobile.live.waitLine`) via `app/live.tsx`, so a bad hub payload
could render "NaN online" or a negative wait count in the live screen.

## Fix
Clamped both `online` and `waiting_peers`/`room_waiting` derivations to
`Math.max(0, Number(...) || 0)` in both reducers, so any non-numeric or negative
input from the hub safely floors to `0` instead of propagating `NaN`/negative into
UI state. No behavior change for well-formed payloads (existing tests still pass).

## Files touched
- `mobile/src/live/hubLobby.ts`
- `mobile/src/live/hubLobby.test.mjs` (mirrored the same clamp in the plain-JS test
  copy, per the file's "keep in sync" comment, and added two new edge-case cases:
  non-numeric `online` + negative `waiting_peers` for both `reduceStatusMsg` and
  `reduceLobbyInfoMsg`)

## Verify commands run
- `node src/live/hubLobby.test.mjs` → `hubLobby.test.mjs ok`
- `npx tsc --noEmit -p .` (mobile/) → only pre-existing unrelated errors (missing
  `expo-clipboard`/`expo-keep-awake` type declarations, etc.); nothing in
  `hubLobby.ts`

## Connect risk
none — pure reducer logic only touched for count derivation clamping; no
CONNECTIVITY_LOCK, MediaSession, offer/ICE/TURN, or deploy paths touched.

COMPLETE
