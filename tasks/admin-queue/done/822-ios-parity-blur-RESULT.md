# 822 — iOS partner blur visual vs Android SoftBlur

## Status
COMPLETE (visual approximation, not a native pixel-blur port)

## What changed
`isSoftBlurNativeAvailable()` in `SoftBlurRemote.tsx` stays Android-only by
design (no `SoftBlurVideoView` native manager exists for iOS in this repo —
no `ios/` native project directory, managed Expo workflow). So on iOS,
`LiveStageVideo` already falls through to `PartnerBlurVeil` for the privacy
cover — that fallback path is what got a real visual upgrade.

`PartnerBlurVeil.tsx` now branches on `Platform.OS === "ios"`:
- **Android** (unchanged): opaque `#45536c` base + hard-edged jittered mosaic
  grid + CTA card. Same behavior/pixels as before this task.
- **iOS** (new): `root`/`rootFill`/`forceOpaque`/`base` backgrounds go
  translucent (`rgba(69, 83, 108, 0.55)` on `base`, `transparent` on the
  outer layers so there's no compounded opacity stacking) and the hard
  mosaic grid is skipped entirely. Only the existing soft `blobA/B/C` color
  washes + `frost`/`frostEdge` overlays paint on top. Because
  `LiveStageVideo` already keeps the partner `RTCView` mounted underneath
  the veil while `remoteBlurred` (never unmounts it — see its own header
  comment), the still-live video now bleeds color/motion through the
  translucent veil, reading as a hazy/blurred partner instead of a fully
  opaque quilt. CTA card / text stay fully opaque and legible on both
  platforms.
- `cells` useMemo short-circuits to `[]` on iOS (no wasted mosaic-cell
  computation since nothing renders it).

`SoftBlurRemote.tsx`: doc-comment only — updated the header to point at
`PartnerBlurVeil.tsx` for where the iOS look now lives, no logic change.

## Files touched
- `mobile/src/live/PartnerBlurVeil.tsx`
- `mobile/src/live/SoftBlurRemote.tsx`

No other files touched. `LiveStageVideo.tsx` / `live.tsx` / `MediaSession.ts`
were **not** edited — the iOS branch lives entirely inside `PartnerBlurVeil`
itself (`Platform.OS` check), so the existing `!softBlurNative` → veil wiring
in `LiveStageVideo` didn't need to change to pick it up.

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — only pre-existing error remains
  (`SoftBlurRemote.tsx:70`, `UIManagerStatic` cast, present before this task
  too — confirmed via `git stash` + rerun). No new type errors from either
  touched file.
- `node scripts/verify-match-ux.mjs` — `L0 done: 139 ok, 0 fail`. This
  includes the PartnerBlurVeil-fallback and ExtraRemoteTile blur-cover
  static checks; both still pass since import/JSX wiring in
  `LiveStageVideo.tsx`/`live.tsx` is unchanged.
- No device available in this worktree to run an actual iOS build/smoke —
  see gap below.

## Remaining gap vs Android SoftBlur
- **Not a real pixel blur.** Android `SoftBlurVideoView` is a native
  `VideoSink` that samples actual decoded frames, downscales, and
  gaussian-blurs them — the partner's face is genuinely blurred but
  recognizable-as-a-person. The iOS veil here is a translucent color/frost
  overlay on top of the *undecoded-by-us* `RTCView` — it reads as "hazy
  glass over a moving video" rather than a true blurred face. It's a much
  closer visual approximation than the old opaque mosaic, but it is not
  frame-accurate blur.
- **No native iOS blur module exists in this repo** to build a real
  equivalent (no `ios/` project, no `expo-blur`/`@react-native-community/blur`
  dependency). Adding one would mean a new npm dependency + native
  autolink + an actual iOS build/prebuild to verify, which is out of this
  task's `OWN` scope (`SoftBlurRemote.tsx` + `PartnerBlurVeil.tsx` only) and
  needs a build owner (Grok doesn't currently have an iOS build script,
  only `build-apk-local.sh` for Android).
- **Untested on-device.** No iOS simulator/device in this environment.
  Verified via `tsc` + the existing static `verify-match-ux.mjs` checks
  only; a real device/simulator smoke is still needed before calling this
  visually final.
- Knowledge spec cited by the task (`knowledge/specs/current-ios-parity.md`)
  and skill (`android-partner-paint`) do not exist in this worktree
  (`knowledge/specs/` only has `2026-08-20-ru-reach.md`) — implemented from
  the task's own Goal/Must-not/Done text and the existing SoftBlur/veil code
  comments instead.

## Connect risk
none — no hub/ICE/MediaSession/live.tsx changes; connectivity-lock script
not run (out of scope for this change, no offer/ICE/media-session touched).
