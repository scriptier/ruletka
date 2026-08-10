# P0: Fix matched-with-zero-SDP + Start→queue reliability (mobile)

You work ONLY in this worktree directory (cwd). Grok Build will review and deploy.

## Problem
Production hub sometimes logs `solo matched` with **no** `kind=offer` / `kind=answer` for many seconds.
Phone can sit on Live with Start not clearly enqueueing (spin deferred if hub flaky).

## Success (must meet)
1. Trace Start → spin → matched → startCall → createAndSendOffer / handleRemoteSignal; fix any real bug that drops first SDP.
2. If `!connected` at Start, ensure spin is sent after reconnect (not only UI enterSearch).
3. Ensure signals that arrive before PC is ready are queued and drained after startCall (mobile).
4. Run `node mobile/scripts/test-connect-ui.mjs` — pass.
5. End with FILES_CHANGED list + how Grok should test.

## Allowed files ONLY
- mobile/app/live.tsx
- mobile/src/media/MediaSession.ts
- mobile/src/hub/HubClient.ts
- mobile/src/hub/HubProvider.tsx
- mobile/scripts/test-connect-ui.mjs

## Do NOT
- Deploy, push, coturn, branding, undo:
  startCallInFlight, offerSentThisCall, gotAnswerThisCall, 15s iceRestart grace

## Already solid (skip re-proving)
- useAutoConnectRetry wired; schedulePeerHardReconnect 15s gate; connectUi soft 16s / hard 20s
