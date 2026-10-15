# 400 — Android find-3rd hunt split polish — RESULT

## Status
DONE

## Context
Audited `mobile/app/live.tsx`, `mobile/src/live/LiveStageVideo.tsx`, and
`mobile/src/live/liveStyles.ts` against the done criteria. Most of the
find-3rd hunt behavior was already correct and shipped (per
`.grok/skills/multi-party-stage/SKILL.md` ship stamps):

- `huntingThird` in `LiveStageVideo.tsx` already wraps the **same** 1v1
  `VideoView` in a top/bottom split (never flips `multiRemote`, never
  unmounts the partner RTCView) — top = partner, bottom = brand loop +
  "Looking for a 3rd…" caption (`splitLookingCaption` / `lookingLabel`).
- `huntingThird` guard already requires `!remoteStream2`, so a real 3rd
  joining cleanly drops the hunt split and falls through to the true
  multi-tile layout.
- `live.tsx` already clears `huntingWithPartner` + `findThirdPending` on
  `next()` (line ~4145), `doStop()` (line ~4260), hangup/disconnect
  handlers (~1540, ~1867, ~2326), and `cancelFindThird()` (~4590) — audited
  all call sites, no gaps found.

The one gap against the done criteria: both hunt tiles shared the **same**
`minHeight`/`minWidth` floor (42%), so there was no asymmetric guarantee
that the live partner tile stays ≥45% while the looking pane stays ≥35%.
Fixed that.

## Changes
- `mobile/src/live/liveStyles.ts`: `splitHuntTile` / `splitHuntTileWide`
  floor raised from 42% → 45% (partner pane). Added
  `splitHuntTileLookingMin` (`minHeight: "35%"`) and
  `splitHuntTileWideLookingMin` (`minWidth: "35%"`) as modifier styles for
  the looking (bottom/right) pane only.
- `mobile/src/live/LiveStageVideo.tsx`: applied the new looking-pane floor
  modifier to the bottom hunt tile's style array (portrait uses
  `splitHuntTileLookingMin`, landscape uses `splitHuntTileWideLookingMin`),
  layered after the existing base/last-border styles so only `minHeight`/
  `minWidth` differs from the partner tile.

## Files touched
- `mobile/src/live/liveStyles.ts`
- `mobile/src/live/LiveStageVideo.tsx`

## Verify commands run
- `cd mobile && npx tsc --noEmit -p .` — pre-existing errors only (missing
  `node_modules` packages in this worktree: `expo-clipboard`,
  `expo-keep-awake`, `react-native-gesture-handler`,
  `react-native-reanimated`, `expo-av`, `react-native-view-shot`, plus a
  few unrelated pre-existing `app/live.tsx` type issues). Zero errors in
  either touched file (`grep -iE "LiveStageVideo|liveStyles"` on the tsc
  output returned nothing).

## Done criteria
- [x] Looking caption visible (already shipped: `splitLookingCaptionText` /
      `lookingLabel` / `L.lookingForThird`)
- [x] Partner tile min ~45% height; looking min ~35%; neither collapses
      (this change)
- [x] `remoteStream2` clears hunt cleanly (already shipped: `huntingThird`
      requires `!remoteStream2`)
- [x] `huntingWithPartner` cleared on hangup/next/stop (audited, already
      correct — no code change needed)
- [x] No `MediaSession.ts` edits (none made)
- [x] No production deploy / push / APK build (none performed)

## Connect risk
none — pure layout/style change (`minHeight`/`minWidth` floors on two
existing hunt-split tiles). No RTC, ICE, TURN, or media-session code
touched. Does not change `multiRemote` / `huntingThird` gating logic.

## Merge advice
Safe to fold into the same PR/branch as the rest of the multi-party stage
work. No conflicts expected — this only edits two style/prop lines inside
files already on this branch's scope.

## Completion promise
COMPLETE
