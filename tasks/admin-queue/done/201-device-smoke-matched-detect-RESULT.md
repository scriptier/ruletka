# 201 — device-smoke: detect matched state on Pixel

Status: COMPLETE

## What changed

`mobile/scripts/device-smoke.sh` now classifies the final on-device UI state instead
of only checking ALIVE/FATAL/crash-UI:

- New `classify_state()` (bash + grep only, no new python) inspects a uiautomator
  dump and sets `classify_verdict` to one of `MATCHED|SEARCHING|IDLE|UNKNOWN`:
  - **MATCHED** — `resource-id="live-report-btn"` present (Report only renders when
    `barPhase==="matched"`, see `mobile/src/live/LiveBottomBar.tsx:147-149`), OR the
    native Gifts panel title (`text="Gifts"`, matched-only per `app/live.tsx:5353`),
    OR a rendered call timer matching `text="d{1,2}:dd"` (`formatCallTimer`, only
    ticks once matched).
  - **SEARCHING** — `live-stop-btn`/`live-next-btn` without `live-report-btn`, or the
    `"Looking…"` search label (`mobile.live.looking`; the old "Looking up" copy is
    already obsolete in this codebase).
  - **IDLE** — `live-start-btn` visible.
  - **UNKNOWN** — dump missing/empty or none of the above matched.
- After the logcat/FATAL check, the script now dumps signals + verdict to
  `artifacts/device-smoke/last-verdict.txt` (written before any exit path, so it's
  always available for overnight loops even on FATAL/crash exits).
- New **regression guard**: if verdict is MATCHED but the `"Looking…"` label is
  still present in the same dump (uiPhase==="matched" should hide
  `LiveSearchLabel`), the script now exits **4** instead of silently reporting OK.
- Updated the header comment: exit code table (`0/1/2/3/4`) + verdict-file blurb.

## Sample `last-verdict.txt`

```
MATCHED
ts=20260811T120301Z
signals=stop,next,report,gifts,timer
device=Pixel 9 Pro (3A221FDH2000XX)
xml=/home/drakosik/freenet-roulette-claude/mobile/artifacts/device-smoke/20260811T120301Z-ui-final.xml
```

(searching example: `SEARCHING` / `signals=stop,next,looking`; idle: `IDLE` /
`signals=start`; regression: `VERDICT=MATCHED` but script exits 4 because
`signals` still contains `looking`.)

## Files touched

- `mobile/scripts/device-smoke.sh`

## Verify commands run

- `bash -n mobile/scripts/device-smoke.sh` — syntax OK
- Extracted `classify_state()` into an isolated shell and ran it against 6
  fabricated uiautomator XML fixtures (matched / searching / idle / matched+stuck
  "Looking…" / empty / missing file) — all five buckets and the regression case
  classified as expected.
- Follow-up real-device run: a Pixel 9 Pro (`45141FDAP0004F`) was online with
  `me.ruletka.app` already installed, so re-ran
  `cd mobile && SKIP_INSTALL=1 WAIT_S=20 ./scripts/device-smoke.sh` for real
  end-to-end confirmation (no install/APK touched). Result: `verdict=IDLE
  signals=start`, exit 0 — the app returned to idle after the Start tap (no
  match partner running), and `artifacts/device-smoke/last-verdict.txt` was
  written correctly:
  ```
  IDLE
  ts=20260811T065152Z
  signals=start
  device=Pixel 9 Pro (45141FDAP0004F)
  xml=.../20260811T065152Z-ui-final.xml
  ```
  Confirms the classify/verdict-write path works against a live uiautomator
  dump, not just fixtures.

## Connect risk: none

Scope was read-only classification of an existing uiautomator dump after the
existing tap/settle flow; no changes to hub, ICE, TURN, offer/answer, or
MediaSession logic. `set -euo pipefail` preserved; new code only adds grep checks
and a file write, no new external calls.

COMPLETE
