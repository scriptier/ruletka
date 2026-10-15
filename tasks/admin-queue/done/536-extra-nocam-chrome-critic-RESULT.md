# 536 — Android extra no-cam chrome — critic RESULT

**Verdict: SHIP**

## Checked (read-only, in /home/drakosik/freenet-roulette main tree, uncommitted herd changes)

1. **StageTileChrome not gated on `!tileNoCam`** — `mobile/src/live/LiveStageVideo.tsx:446` gates chrome on `!privacyBlur` only; `tileNoCam` (advertisedNoCam / audio-only) does not suppress it. Confirmed both by direct read and by `verify-match-ux.mjs`'s own grep-equivalent check ("ExtraRemoteTile StageTileChrome not gated on !tileNoCam" → OK).
2. **Name · ★ · loc · one flag over NoCamPortrait, elevation/zIndex** — `StageTileChrome` renders after `NoCamPortrait` in JSX (comment at line 445: "Chrome after NoCamPortrait so name/★/loc/flag stay readable on cylinder") and its styles (`splitTileChrome`, `splitTileVolume` in `liveStyles.ts:821,861`) both carry `zIndex: 8` / `elevation: 12`, newly added in this diff. `NoCamPortrait.tsx` has no elevation/zIndex of its own, so the chrome reliably paints on top on Android SurfaceView stacks. Single flag glyph rendered once beside ★ (`tileFlagGlyph`), not duplicated.
3. **Loc omitFlag** — `mobile/app/live.tsx:7137-7144` builds `extraTileChrome[].loc` via `formatLocLine({ ..., omitFlag: true })`. `LiveStageVideo.tsx` additionally strips any leading flag glyph defensively via `locTextWithoutFlag` (belt-and-suspenders, harmless).
4. **First VideoView key stays `live-first-remote`** — unchanged at `LiveStageVideo.tsx:945`. No remount, no MediaSession touch in this code path.

## Verify commands run

```
node mobile/scripts/verify-match-ux.mjs   → L0 done: 55 ok, 0 fail
node mobile/src/live/stageStreams.test.mjs → ok
```

Both exit 0.

## Scope check

No `pool>0`, no `push.sh`, no invented `MULTI_PASS` marker found in the nocam-chrome-relevant diff hunks (searched `LiveStageVideo.tsx` / `live.tsx` diff). `MediaSession.ts` and `ui/webrtc.js` do have uncommitted changes on this branch, but those are from other concurrent herd specs (connectivity/partner-actions), not from the ExtraRemoteTile/StageTileChrome edit — the chrome change itself does not reference either file.

## Files touched by this critic

None (read-only review). Only this RESULT file written.

## Connect risk

none — overlay-only chrome change, no ICE/MediaSession/offer path touched by the reviewed diff.

COMPLETE
