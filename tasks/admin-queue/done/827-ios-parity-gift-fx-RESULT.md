# RESULT: 827-ios-parity-gift-fx

## Status
COMPLETE (best-effort, static-analysis only — no physical iPhone/simulator
available to this agent; needs Grok/human TestFlight smoke to confirm).

## Context / note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(`knowledge/specs/` here only has `2026-08-20-ru-reach.md`); read it from the
main tree (`/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`).
Same DONE WHEN / MUST NOT as the prior 82x chain (820–826): add `Platform.OS`
branches where Android has chrome; no MediaSession/ICE/pool>0.

## What I found
`GiftFxOverlay.tsx` had exactly one `Platform.OS` branch in the whole file:
the FX root View got `styles.rootAndroid` (`elevation: 32`) on Android only,
with no iOS counterpart:

```tsx
style={[styles.root, Platform.OS === "android" ? styles.rootAndroid : null]}
```

`elevation` is Android's mechanism for lifting the FX layer above the
zOrder-0 `SurfaceView`-backed remote tile (see `LiveStageVideo.tsx` comments
on "RN elevation can cover SurfaceView"). iOS `RTCView` isn't a hole-punch
surface, so plain subview order already keeps the FX layer above the video —
but that also meant the FX View had zero visual depth cue on iPhone: on
Android the elevation adds a soft shadow around the tile as the FX pops in,
on iOS there was nothing, so on extra (multi-remote) tiles the gift
animation could read as flat/washed-out against the tile edge — the "looks
empty" symptom named in the task. The file already has an established
Android-elevation / iOS-shadow* pairing for exactly this depth cue
(`fwCoreBloom`'s comment: "Android glow proxy (shadow* is iOS-only)").

## What changed
**`mobile/src/stars/GiftFxOverlay.tsx`**
- Added a `Platform.OS === "ios" ? styles.rootIOS : null` branch alongside
  the existing Android one on the FX root View.
- New `rootIOS` style: `shadowColor/shadowOpacity/shadowRadius/shadowOffset`
  — the same shadow-based depth cue this file already uses elsewhere
  (`fwCoreBloom`) as the iOS analog of Android `elevation`. Android output
  is byte-identical (shadow* is a no-op there without `elevation`, which
  iOS ignores in turn — the two branches don't interact).

No other lines touched. `live.tsx`, `LiveStageVideo.tsx`, `MediaSession`,
and any deploy/EAS/TestFlight paths were **not** edited — the branch lives
entirely inside `GiftFxOverlay.tsx`'s own root style, so callers (`live.tsx`,
`LiveStageVideo.tsx`) pick it up with no wiring changes.

## Files touched
- `mobile/src/stars/GiftFxOverlay.tsx`

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — no errors referencing
  `GiftFxOverlay.tsx`. Remaining output is pre-existing/unrelated (missing
  native module type declarations in this worktree's `node_modules`, and
  pre-existing errors in other files).
- `node src/stars/giftFxVisual.test.mjs` — `giftFxVisual.test.mjs OK`.
- No iOS simulator/device in this environment — verified via types + the
  existing visual test only, not an on-device TestFlight smoke.

## Remaining gap / caveat
This is a depth-cue parity fix, not a proven fix for a confirmed rendering
bug: I could not reproduce "empty on iPhone" on-device to confirm the root
cause was literally missing shadow (vs. some other extra-tile compositing
issue in `LiveStageVideo.tsx`, which is out of this task's `OWN` scope).
Needs a human/Grok TestFlight smoke on an extra-tile (3-way) call to confirm
the gift FX now reads with the same visual weight as Android.

## Connect risk
none — no hub/ICE/MediaSession/live.tsx changes; connectivity-lock script
not run (out of scope, no offer/ICE/media-session touched). Change is a
presentation-only shadow style on an already-existing overlay component.

COMPLETE
