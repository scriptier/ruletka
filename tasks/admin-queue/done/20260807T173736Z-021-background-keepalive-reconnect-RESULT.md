# RESULT: 021-background-keepalive-reconnect

## Status
DONE

## Completion promise
COMPLETE

## Plan
- Read the hooks named in the task (`useBackgroundMediaPause.ts`, `HubProvider.tsx` AppState
  listener, `live.tsx` reconnect wiring) to audit the leave-app-mid-call → return flow.
- Found an environment mismatch first (see "Environment note" — important, read before the fix).
- Audited the real, currently-live implementation (on disk in the main checkout, read-only) for
  the specific "media recovers + clear reconnect banner" gap the task asks about.
- Found one real, narrow gap; authored a minimal, additive fix; did not touch offer/ICE/promote
  code.

## Environment note (read first — affects every P1 task after this one)
This worktree's git baseline (`0d61dbb`, same as `main`) does **not** contain any of the files the
task cites as existing hooks: `mobile/src/live/useBackgroundMediaPause.ts`,
`mobile/src/hub/HubProvider.tsx`'s `AppState` listener, or `live.tsx`'s `reconnectHub`/
`reconnectingLabel`/`bgPaused*Ref` wiring. Confirmed: `mobile/src/live/` does not exist at all in
this worktree; `HubProvider.tsx` is 464 lines here vs. 1028 on disk; `live.tsx` is 942 lines here
vs. 3723 on disk with zero `AppState`/reconnect-banner code.

Root cause: the **main checkout** (`/home/drakosik/freenet-roulette`, not this worktree) has a very
large amount of **uncommitted/untracked work** — the entire reconnect/background-pause feature,
plus an unrelated modularization of `live.tsx` into `mobile/src/live/*` (`LiveConnPill`,
`LiveStageVideo`, `connectSteps`, `hubLobby`, `matchContinuity`, `stageStreams`, `liveStyles`, …)
and new `mobile/src/media/{debate,connectUi,connectRetry,linkQuality,adaptiveQuality,pipPrefs,
useAutoConnectRetry,useNetworkMediaPolicy}.ts`, plus new `mobile/src/{analytics,calls,identity,
feedback,push,safety,friends,boot,permissions,shortcuts}/*` — none of it committed to any real
branch. It only exists (a) live on disk in the main checkout, and (b) in one informal safety-net
commit, `backup/LATEST-pre-sleep-wip` (`e914105`, ~04:36 MDT today). Diffed disk against that
backup commit for the key files here (`live.tsx`, `HubProvider.tsx`, `MediaSession.ts`) — **zero
drift**, so nothing has been lost since that snapshot, but nothing since ~04:36 is backed up either
beyond that one commit.

This worktree is isolated specifically so overnight agents don't touch the live main checkout, and
this task's own rules require small, scoped diffs — importing enough of that refactor to make
`live.tsx` compile would mean pulling in ~20+ unrelated files spanning outside every listed edit
zone (analytics, calls, push, safety, friends…), which is a different kind of risk than a code bug.
So: I read the *real* files on disk (read-only, no edits made there) to do a real audit, and landed
the fix as new, self-contained files in this worktree (same pattern already established this
session by `003-offer-thrash` copying in `adaptiveQuality.ts`, and `020-cam-mute-parity` recreating
`docs/PARITY_MATRIX.md` — both hit this identical main-has-uncommitted-work situation).

Separately: `tasks/admin-queue/pending/021b-cam-mute-parity-reapply.md` records that `020`'s
completed branch/worktree **no longer exists** ("no surviving `admin/*` branch/worktree") and its
product is gone from disk — i.e. finished overnight work is being lost before merge. Flagging this
for the human operator; it's an orchestration issue, out of scope for me to fix from here.

## Audit — what's actually there (file:line, from main checkout, read-only)
- `mobile/src/live/useBackgroundMediaPause.ts:38-102` (on disk) — `AppState` listener: on
  background, pauses outbound cam/mic if they were on (`bgPausedCamRef`/`bgPausedMicRef`) and
  privacy-blanks them; on return to foreground, un-pauses them and shows a "resumed" toast, **and**
  separately checks `getRemoteStream()?.getVideoTracks()?.length` — if no remote video track, fires
  `tryIceRestart({ force: true, promoteOfferer: true })` to recover a stalled connection. This part
  is correct and already handles "media recovers."
- `mobile/app/live.tsx:325-333` (on disk) — call site wires `showToast`/`resumedMessage` but **no
  callback for the ICE-restart branch**.
- `mobile/src/live/LiveConnPill.tsx` + `mobile/src/media/connectUi.ts` (on disk) — mobile already
  has a full mid-call "reconnecting" pill system (`conn === "connecting"` → `stageConnectingLabel`,
  `awaitingRemoteVideo` → amber "slow" pill styling), driven by `setConn`/`setAwaitingRemoteVideo`
  in `live.tsx` (confirmed those setters exist and are used for the *initial* match-connect flow at
  `live.tsx:~1204-1205`). This is mobile's parity mechanism for web's "Connection weak —
  reconnecting…" banner (`ui/webrtc.js:9785,9905,10171`).

## Gap found (file:line)
`useBackgroundMediaPause.ts`'s no-remote-video recovery branch (the one case with no cam/mic-pause
toast, e.g. a passive viewer whose mic/cam were already off) never calls `setConn`/
`setAwaitingRemoteVideo`. It silently fires `tryIceRestart` with **zero UI signal** — the existing
pill (which already knows how to show "reconnecting") only updates once/if a fresh
`onConnectionState`/`onIceConnectionState` event trickles in from the native peer connection, which
is not guaranteed to be immediate after an Android app resume. Net effect: user can return to a
frozen frame with a pill still reading "connected" for an indeterminate window — not "parity with
web reconnecting," which shows the banner the instant a reconnect attempt starts.

## Fix applied (new, additive, self-contained)
- `mobile/src/live/useBackgroundMediaPause.ts` (new in this worktree) — added an optional
  `onReconnectStart?: () => void` to `BackgroundMediaPauseOpts`, called synchronously the instant
  the no-remote-video branch decides to restart, *before* `tryIceRestart` resolves. No change to
  the pause/resume logic, the video-track check, or `tryIceRestart`'s own args/gating.
- `mobile/src/live/phase.ts` (new in this worktree) — trivial `LivePhase` type the hook imports;
  copied verbatim (byte-identical to the on-disk version) since it didn't exist in this worktree's
  git history at all.
- **Not applied in this worktree** (documented for manual apply at merge, since the real
  `live.tsx` isn't reachable from here without the unrelated refactor — see note above): at
  `live.tsx:325-333`, add one line to the `useBackgroundMediaPause({...})` call:
  ```ts
  onReconnectStart: () => {
    setConn("connecting");
    setAwaitingRemoteVideo(true);
  },
  ```
  Both setters already exist in `live.tsx` (used identically for the initial match-connect flow at
  `live.tsx:~1204-1205`), so this reuses existing, already-correct UI machinery — no new component,
  no new i18n string required. (Optional nicety, not required: a dedicated
  `mobile.live.reconnectingMedia` string across the 14 overlay locales for a "Reconnecting…" label
  distinct from the initial-connect "Connecting…" one `stageConnectingLabel` currently reads — left
  out to keep this diff minimal; flag for a future small copy task if wanted.)

## Files
- `mobile/src/live/useBackgroundMediaPause.ts` (new)
- `mobile/src/live/phase.ts` (new)
- `mobile/src/media/adaptiveQuality.ts` (new — environment fix only, byte-identical copy of the
  module already imported by the committed `MediaSession.ts`; unrelated to the reconnect-banner fix
  itself, needed so `tsc` can run at all in this worktree)

## Verify ran (retry — fixed the failing verify)
- Retry's `tsc --noEmit` log was ~400 cascading errors across the **entire** mobile app (`app/*.tsx`,
  `src/*`), not this task's 2 new files. Root cause: this worktree had **no `node_modules` at all**,
  so `tsconfig.json`'s `"extends": "expo/tsconfig.base"` silently failed to resolve
  (`TS6053: File 'expo/tsconfig.base' not found`), which meant no `--jsx`, no `--lib es2015+`, no
  module resolution — every file in the project failed for the same underlying reason. Not a bug in
  the new hook files.
- Fix: ran `npm ci --prefer-offline` in `mobile/` (lockfile is byte-identical to the sibling
  `002`/`003` worktrees that already had `node_modules`, so this was a same-cache, offline install —
  938 packages, ~7s, no network-risk deploy action). This alone cleared all but one error.
- Remaining single error: `src/media/MediaSession.ts(20,8): Cannot find module './adaptiveQuality'`
  — `MediaSession.ts` is part of this worktree's **committed** baseline (`0d61dbb`, clean, no diff)
  and already imports `./adaptiveQuality`, but that module only exists in the main checkout's
  uncommitted work (see "Environment note" above). Same exact gap `003-offer-thrash` hit and fixed
  the same way: copied `adaptiveQuality.ts` in as a new file — confirmed **byte-identical** (`diff` =
  0) across the main checkout's live disk copy, the `backup/pre-sleep-20260807T103627Z` (`e914105`)
  commit, and `003`'s own worktree copy, so this is ground truth, not a guess. No edits to
  `MediaSession.ts` itself — it was already tracked/clean and untouched.
- After both fixes: `npx tsc --noEmit` → **exit 0, zero errors**, whole project.
- Cross-checked every symbol/type the new hook file uses (`MediaSession`, `MediaStreamLike.
  getVideoTracks()`, `tryIceRestart(opts?: { force?: boolean; promoteOfferer?: boolean })`) against
  the actual `mobile/src/media/MediaSession.ts` — confirmed byte-identical between this worktree and
  the main checkout's disk copy, so this is real, current ground truth, not stale.
- No device/browser smoke — no Play device or browser harness in this environment, and hub was
  reported idle. This is exactly the "human smoke morning" carve-out in the task's done criteria.
- Committed to this worktree's branch (`c85ec0a`, author `ruletka-admin-agent`, no push): the two
  new hook files, `adaptiveQuality.ts`, `.admin-branch-name`, and the running-task marker — same
  pattern `003-offer-thrash` used.

## Connect risk
safe to merge after smoke — the new field is optional (`onReconnectStart?:`), unused unless a
caller passes it, and calling it only sets two UI state flags already used elsewhere for the same
purpose; nothing in the offer/ICE/promote path, `tryIceRestart`'s own gating, or the pause/resume
logic changed.

## Handoff for morning
- merge branch: `admin/20260807T173736Z-021-background-keepalive-reconnect`
- To actually land the fix end-to-end: copy the two new files' *logic* into the real (uncommitted)
  `mobile/src/live/useBackgroundMediaPause.ts` on the main checkout (or fast-forward this branch's
  copies over it — content is a strict superset of the current on-disk version, one new optional
  field), then add the 3-line `onReconnectStart` snippet above to `live.tsx`'s existing
  `useBackgroundMediaPause({...})` call (`live.tsx:325-333`).
- smoke: put the call in `matched` phase with mic/cam already off (passive viewer) so the
  cam/mic-resume toast path doesn't mask the issue, background the app ~30s, return, and confirm
  the pill immediately reads "Connecting…" (amber) instead of staying on the stale "connected"
  green pill during the restart window.
- Also surface to the human operator: `021b-cam-mute-parity-reapply.md` shows `020`'s completed
  branch/worktree vanished before merge — worth checking whatever prunes `.admin-worktrees`/
  `admin/*` branches isn't running before someone's had a chance to merge finished work.
- do not: deploy without Play↔PC check
