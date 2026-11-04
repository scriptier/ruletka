# 401 — MediaSession secondary multi: never kill primary cam

## Status
COMPLETE (verify-only — Grok's implementation already satisfied all done criteria; no code changes were needed).

## Verification performed

Read `mobile/src/media/MediaSession.ts` in full and traced every path touching
`secondaryLink` / `localStreamOwned` / GUM / `closeCall`:

- **Secondary closeCall never stops shared preview.**
  `closeCall()` (line ~5661) computes `mayStopLocal = localStreamOwned && !secondaryLink`
  before the full-hangup track-stop loop (line ~5771), and the `keepLocal &&
  secondaryLink` branch (line ~5793) drops the local stream reference without
  calling `.stop()`, only releasing owned clone tracks via `releaseOwnedClones()`.
  Tracks are also detached from senders (`detachLocalSenders()`, replaceTrack(null))
  before `pc.close()` so RN's close-time track teardown can't reach shared tracks.

- **No GUM on secondaryLink paths.**
  All three getUserMedia call sites are centrally guarded:
  - `ensureLocalStream()` (line 1499) returns `null` early if `secondaryLink` is
    true, before touching `openLocalStream()`.
  - `openLocalStream()` (line 1652) also independently guards `secondaryLink`.
  - `refreshLocalVideoTrack()` (line 1520) guards `secondaryLink` and instead
    just re-enables existing (cloned/shared) video tracks — no GUM, no stop.
  - `attachLocalTracksIfNeeded()` (line 2867), called from every `startCall` /
    `adoptLocalStream` / recovery path, only calls `replaceTrack`/`addTrack`
    against `this.localStream` — never GUM, so it's inert for secondary links.

- **`setMultiPeerAudio(on, { secondary })`** (line 1203): secondary branch only
  clamps `qualityCeiling` to `"low"` and calls `applyQualityTier("low")`
  (bitrate/encoder params only) — no track stop, no replaceTrack thrash, no GUM.

- **`iceCandidatePoolSize`** is hardcoded to `0` in `pcConfig()` (line 1737),
  unconditionally (not gated by secondary/primary).

- **hop9 pure-answer budget** untouched: `Math.min(this.relayWaitBudgetMs(), 280)`
  still caps the relay-wait at 280ms (line 5372); no changes made near the
  offer/answer/ICE code paths.

## Files touched
None — read-only verification pass. `MediaSession.ts` unchanged.

## Verify commands run
- `npx tsc --noEmit` — no errors in `MediaSession.ts` (pre-existing unrelated
  errors in other files: missing `expo-clipboard`/`expo-av`/etc. type decls in
  this worktree's `node_modules`, out of scope).
- `node mobile/src/media/connectUi.test.mjs` → OK
- `node mobile/src/media/offerSdpLooksPureRelay.test.mjs` → OK
- `./scripts/test-connectivity-lock.sh` not present in this worktree (untracked
  in main tree, not part of `freenet-roulette-claude` git history) — skipped;
  no ICE/hub/offer code was touched so this is low-risk, but Grok should run it
  on the main tree before merge per CONNECTIVITY_LOCK policy.

## Connect risk
none — no code changes made.

COMPLETE
