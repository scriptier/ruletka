# RESULT: 100-pair-smoke-headless

## Status
DONE — script ran against prod; media budget FAILED this run (forensics only, no fix attempted).

## What changed
- Added `scripts/prod-pair-media.mjs`: two headless Chromium tabs (separate
  incognito browser contexts, distinct fake `nextface-user-v1` identities so
  the hub doesn't collide them) against `https://ruletka.vip/live.html`,
  fake camera/mic, `BUDGET_MS` default 45000 (env-overridable). Polls every
  3s for remote `framesDecoded`/`videoWidth` via `getStats()`, hooks
  `RTCPeerConnection` for ice/connection-state/track console lines, and taps
  the existing `window.getIcePathKind` / `sessionForceRelayEnabled` globals
  from `ui/webrtc.js` for path info. PASS only when both sides show actual
  decoded frames or non-zero video dimensions (not just a "live" track,
  which I found comes up green well before real frames flow — see fix
  note below). On timeout: logs FAIL and saves screenshots to
  `mobile/artifacts/prod-pair-{A,B}.png` (gitignored).
- Chrome binary and `puppeteer-core` are resolved from a small candidate
  list (`/usr/bin/google-chrome`, `/opt/google/chrome/chrome`, plus the
  existing ad hoc `puppeteer-core` installs already present at
  `/home/drakosik/freenet-roulette/node_modules` and
  `/tmp/node_modules`) rather than hard-required — if neither is found the
  script logs `BLOCKED` and exits 3 without a stack trace. Neither is a
  declared repo dependency (no root `package.json`), consistent with how
  the pre-existing (uncommitted, main-tree-only) `pair-test-headless.mjs`
  / `pair-smoke.mjs` already do this.
- Found and fixed a bug in my own first draft before this ran cleanly: a
  top-level `const URL = ...` shadowed the global `URL` constructor used
  for `new URL(TARGET_URL).origin` — renamed the env-derived target to
  `TARGET_URL`.

## Files
- `scripts/prod-pair-media.mjs` (new)

## Verify commands run
- `node --check scripts/prod-pair-media.mjs` — syntax OK
- `node scripts/prod-pair-media.mjs` (BUDGET_MS default 45000) — ran twice
  against live prod. Chrome present at `/usr/bin/google-chrome`;
  `puppeteer-core@24.43.1` resolved via the fallback path.

### Run 1 (before tightening the PASS check)
Matched in ~5s (`matched with PairBot-... · solo`), both sides reached
`ice=checking`/`cs=connecting` with a live remote track — script declared
PASS at age=3s. On inspection this was too loose: `framesDecoded=0` and
`videoWidth=0` on both sides at PASS time, i.e. it was reporting a live
track, not actual video frames. Tightened the PASS condition to require
`frames > 0 || videoW > 0` and re-ran.

### Run 2 (after the fix, full 45s budget) — FAIL, real forensics
- Both bots matched immediately (~5s in), `force_relay=true` on both
  (expected per `docs/CONNECTIVITY_LOCK.md` §5 — same-host headless bots
  share one public IP), `policy=relay pure`, TURN configured (`ICE: 3
  group(s) · TURN on`).
- Offer/answer/track exchange happened fast (`offer path ms 362`,
  `CONNECT ... track=1763ms kind=video`) — SDP and track negotiation are
  not the problem.
- `ice=checking` persisted, never reached `connected`. At ~17s:
  `ice=disconnected`, `cs=failed` on both sides, then
  `[soft recover] skipped — match grace 17351 30000 failed`.
- At ~20s: `black_watch 20s one restart ice=disconnected` fired the
  existing one-shot ICE-restart path. Side A rebuilt a pure-relay PC
  (`offer no relay — rebuild pure-relay PC and retry once`); side B called
  `restartIce()` but then logged `skip remote offer — already negotiated,
  ICE checking` — i.e. A's rebuilt offer never got answered.
- From ~24s to the 45s budget cutoff: A sat at `ice=new/cs=new`
  (post-rebuild, never re-offered/answered), B sat at
  `ice=checking/cs=connecting` indefinitely. Zero frames on either side
  the entire run.
- Screenshots saved: `mobile/artifacts/prod-pair-A.png`,
  `mobile/artifacts/prod-pair-B.png` (both show the empty/placeholder
  remote tile, consistent with the stats).
- Exit code 2 (FAIL, no mutual frames).

**Read on this, not acted on (task says forensics only):** this smells like
a same-host/same-IP `force_relay=true` pure-relay TURN allocation problem
specific to two headless bots on one box (both hairpinning through the
same TURN server from the same public IP), and/or the one-shot ICE-restart
path's re-offer getting dropped by the answerer-already-answered guard
(`docs/CONNECTIVITY_LOCK.md` client rule #2). It is *not* necessarily
representative of a real cross-network Play↔PC or browser↔browser pair,
which is the actual #1-priority path. Did not touch ICE/TURN/force_relay
code or retry policy to chase this — flagging for a human with real
two-network hardware to decide if it's worth investigating.

## Connect risk
low — new standalone script only; no `mobile/src/media`, `ui/webrtc.js`,
`ui/live.js`, or hub/ICE code touched. Existing `./scripts/dev-smoke.sh`
untouched. Screenshots are gitignored (`mobile/.gitignore` `artifacts/`),
nothing new gets committed there.

## COMPLETE
