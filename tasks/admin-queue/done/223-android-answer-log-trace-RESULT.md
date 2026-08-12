# 223 — Android: log offer→answer path for black remote diagnosis

## Status
COMPLETE

## What changed
Added temporary, high-signal `console.log("[client-ice] ...")` lines (greppable via
`adb logcat -s ReactNativeJS`) tracing the full offer→answer lifecycle on both the
answerer path (inbound offer → setRemoteDescription → createAnswer →
setLocalDescription) and the offerer path (inbound answer → setRemoteDescription,
including the renego branch). No pool/force_relay/ICE-budget changes.

### mobile/src/media/MediaSession.ts
- `handleRemoteSignal`: log on every inbound `offer`/`answer` signal — kind, current
  `iceConnectionState`, `has_local_desc`, `has_remote_desc`.
- Offer path: log around `setRemoteDescription` (start/ok/fail, incl. the
  rebuild-and-retry fallback), `createAnswer` (start/ok), and `setLocalDescription`
  (start/ok incl. ice state/has_local_desc/fail).
- Answer path (offerer applying remote answer): log around `setRemoteDescription`
  for both the first-apply branch and the renego branch (start/ok/ok_renego).
  The renego branch previously swallowed errors silently (`catch { /* ignore
  stale answer */ }`) — now logs `fail_renego` with the error message before
  ignoring, since this silent catch is a plausible culprit for "matched but
  never applied answer".
- Outer catch in `handleRemoteSignalInner` (previously only routed to
  `handlers.onError`, which never reaches logcat): now also logs
  `handleRemoteSignal:fail` for offer/answer kinds.
- `pc.oniceconnectionstatechange`: now logs `iceConnectionState=<state>
  has_local_desc=... has_remote_desc=...` on every transition (shared handler
  for both offerer/answerer PCs), so a stuck `ice=new` is directly visible in
  the log stream.

### mobile/app/live.tsx
- Hub `signal` handler (`case "signal"`): logs `[client-ice] signal recv
  kind=offer|answer peer=<short id>` on receipt, and `applied ok` /
  `applied fail err=...` when `MediaSession.handleRemoteSignal(...)` resolves
  or rejects (this promise rejection path previously only went to the in-app
  debug buffer via `log()`, not logcat).

## Sample log lines (expected sequence, answerer/phone side)
```
[client-ice] signal recv kind=offer peer=3f9a21bc
[client-ice] recv kind=offer ice=new has_local_desc=false has_remote_desc=false
[client-ice] offer setRemoteDescription:start sigState=stable
[client-ice] offer setRemoteDescription:ok
[client-ice] createAnswer:start
[client-ice] createAnswer:ok
[client-ice] answer setLocalDescription:start
[client-ice] answer setLocalDescription:ok has_local_desc=true ice=new
[client-ice] iceConnectionState=checking has_local_desc=true has_remote_desc=true
[client-ice] iceConnectionState=connected has_local_desc=true has_remote_desc=true
[client-ice] signal offer applied ok
```

Failure signature to grep for (matches the nightly-smoke symptom — matched but
stuck `ice=new bind_v=0`): a `recv kind=offer` with no matching
`setRemoteDescription:ok` / `applied ok` afterward, or a
`setRemoteDescription:fail` / `handleRemoteSignal:fail` / `fail_renego` line.

## Files touched
- mobile/src/media/MediaSession.ts
- mobile/app/live.tsx

## Verify commands run
- `cd mobile && npx tsc --noEmit` — pre-existing errors only (missing native
  module typings, unrelated `RTCPeerConnectionLike.iceGatheringState` issue at
  lines 414/445 that predates this change); no new errors introduced by the
  added log lines (confirmed via `git diff` around each `[client-ice]` hunk).
- `git diff mobile/src/media/MediaSession.ts mobile/app/live.tsx | grep client-ice`
  — confirms all 19 log call sites landed as intended, nothing else touched.

## Connect risk
none — pure `console.log` additions on existing code paths; no control-flow,
timing, ICE policy, or pool changes. No deploy/push/APK actions taken.

COMPLETE
