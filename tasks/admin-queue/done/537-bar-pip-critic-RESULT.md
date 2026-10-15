# 537 — Android bar vs PiP — critic RESULT

## Verdict: FIX

Spec `knowledge/specs/2026-08-15-android-bar-pip.md` is **not implemented**. Herd
`20260815T225522Z` did not land the required changes to `LiveBottomBar.tsx`.

## Checks

1. **FAIL** — `LiveBottomBar` still has `live-report-btn` and `live-friends-btn`.
   - `mobile/src/live/LiveBottomBar.tsx:227` — `testID="live-report-btn"` on the
     danger Report button, rendered whenever `showReport` (matched + stranger).
   - `mobile/src/live/LiveBottomBar.tsx:292` — `testID="live-friends-btn"` on the
     Friends icon in the secondary icon row.
   - The file's own header comment (lines 1–15) still documents "Report (middle,
     danger...)" and "Friends · Mic · Flip · partner mute · blur · more" as the
     current layout — i.e. this hop was never applied.

2. **FAIL** — No left-align / `paddingRight >= PIP_W (108)` anywhere.
   - `mobile/src/live/DraggablePip.tsx:12` confirms `PIP_W = 108`, but nothing in
     `LiveBottomBar.tsx`, `liveStyles.ts`, or `live.tsx` references `PIP_W` or
     applies a matching `paddingRight`.
   - The secondary icon row (`live.tsx` → `LiveBottomBar` rendered inside
     `styles.bar` / `styles.browserDock`) uses
     `justifyContent: "space-between", width: "100%"`
     (`LiveBottomBar.tsx:274-283`), which spreads icons edge-to-edge and pins
     Settings to the far right — the opposite of "left-aligned, clear of the
     self PiP." `liveStyles.ts:1611` (`bar: { paddingHorizontal: 16, ... }`) has
     no PIP-aware padding either.
   - Net effect: the self-cam PiP overlap the spec exists to fix is still
     unresolved.

3. **PASS** — Report still present in the partner-actions sheet.
   - `mobile/src/live/LiveMoreSheet.tsx:268-273` has `onPress={onReport}` /
     `L.report` row.

4. **PASS** — First remote VideoView key stable.
   - `node mobile/scripts/verify-match-ux.mjs` → `L0 done: 70 ok, 0 fail`,
     including `OK first VideoView still key=live-first-remote`. (This script
     is the general match-ux suite; it does not itself assert on
     live-report-btn/live-friends-btn/PIP_W — those were checked by direct
     read/grep per the spec's own EVAL line.)

## Files touched
None (read-only review).

## Verify commands run
- `grep -n "live-report-btn\|live-friends-btn" mobile/src/live/LiveBottomBar.tsx`
- `grep -n "PIP_W" mobile/src/live mobile/app` (no hits outside `DraggablePip.tsx`/`index.ts`)
- `node mobile/scripts/verify-match-ux.mjs` → 70 ok, 0 fail
- Diffed `mobile/src/live/LiveBottomBar.tsx` between this worktree and
  `/home/drakosik/freenet-roulette` main tree — identical, confirming the
  reviewed file is the current post-herd state.

## Connect risk
none — read-only review, no product files edited.

## Recommendation
Send back to build: remove `live-report-btn` + `live-friends-btn` from
`LiveBottomBar.tsx`'s matched/secondary rows (Report stays only in
`LiveMoreSheet`), and left-align the icon strip + Stop/Next with
`paddingRight: PIP_W` (or greater) instead of `justifyContent: "space-between"`.

COMPLETE
