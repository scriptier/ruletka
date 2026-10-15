# RESULT: 842-ios-duo-second-critic

## Status
COMPLETE (read-only static-analysis second critic — no iPhone/simulator/
TestFlight access; corroborates and extends `838-ios-duo-critic-RESULT.md`
independently, does not just restate it).

## Question asked: will TestFlight get rotate L|R after next IPA?

**Yes, on current code — with one non-code caveat (see Blockers #1).**

Evidence:
- `mobile/app.json:7` → `"orientation": "default"` (working tree). This is
  the Expo config key that maps to `UISupportedInterfaceOrientations` on iOS.
  `"default"` means *no restriction is written*, so the iOS project keeps the
  template's built-in orientation set (Portrait + LandscapeLeft +
  LandscapeRight for iPhone) — same as `"orientation": "default"` on Android
  (`android:screenOrientation="unspecified"`). Confirmed no override lower in
  `mobile/app.config.js` (`grep -n "orientation"` → 0 hits) and no `ios/`
  native project checked in (`find ... -iname ios -o -iname "*.xcodeproj"` →
  none) — this is a managed/CNG build, so app.json's `orientation` is
  regenerated fresh on every EAS build, there is no stale native plist to
  drift from it.
- No `ScreenOrientation`/`lockAsync`/`expo-screen-orientation` anywhere in
  `mobile/src` or `package.json` (`grep -rn` → 0 hits) — nothing in JS
  re-locks orientation at runtime on either platform.
- The two-tile flip itself (`LiveStageVideo.tsx:842` `splitWide = layoutW >
  0 && layoutH > 0 && layoutW / layoutH >= 1.15`) is driven by **measured**
  `Dimensions`/`onLayout` aspect ratio, not by a `Platform.OS` branch or a
  locked-orientation assumption. Independently re-grepped (not just trusting
  838's numbers): `grep -n "Platform" LiveStageVideo.tsx` → **0 hits**;
  `youTileDock`/`youTileDockWide` render block (`LiveStageVideo.tsx:1701-
  1714`) and styles (`liveStyles.ts:393-416`) have zero `Platform.select` /
  zero iOS branch. Same code path, same math, both platforms — this matches
  838's finding and I confirm it holds with a fresh grep rather than
  citing 838 alone.
- `VideoView.tsx` (RTCView wrapper) styles the native view with
  `StyleSheet.absoluteFillObject` (`liveStyles` `rtc` style,
  `VideoView.tsx:111`) and explicitly avoids remounting on layout-only
  changes (`rtcKey` only churns on stream/epoch/zOrder, per its own comment
  "Do not remount on every layout tick"). So on rotate, RN just re-lays-out
  the existing native view to the new `youTileDock`/`youTileDockWide` frame
  — the same mechanism Android already relies on, no additional iOS-only
  step required in JS.
- `840-ios-duo-testflight.md` (blocked, `tasks/admin-queue/blocked/`)
  confirms the spec intent this code implements: "portrait partner top / you
  bottom; landscape partner left / you right. Same as Android 0.1.477" —
  matches `youTileDockWide` (`left:"50%", right:0` → you-tile docks right in
  landscape, partner occupies the left remainder), so the layout code and
  the documented TestFlight-notes intent agree.

## Blockers / risks (why this is "should work," not "verified working")

1. **Non-code, operational blocker: the orientation fix is currently
   uncommitted working-tree state, not yet in any shipped IPA.**
   `git log -p -- mobile/app.json` shows the last **committed** value on
   this branch (`349970c`) is `"orientation": "portrait"` / `"version":
   "0.1.1"` — the `"default"` / `"0.1.477"` values I verified above only
   exist as an uncommitted `git diff` in this worktree (`git status` shows
   356 modified paths, none committed). Per this repo's factory workflow
   ("Grok will harvest your diffs after you finish"), this is expected and
   not a code defect — but it means the answer to "will TestFlight get
   rotate L|R after next IPA" is conditional on this diff actually being
   harvested into the build Grok cuts. If a future EAS build is cut from a
   tree that still has `"orientation": "portrait"`, rotation will not
   happen at all (iOS will refuse to rotate past portrait), independent of
   everything else in this RESULT. `840-ios-duo-testflight.md` (blocked)
   confirms the IPA already in TestFlight (0.1.477 b5, submission
   `963014fd`) predates this and later duo hops — this ticket's notes are
   explicitly scoped to the **next** IPA, not the one currently in review.

2. **No device/simulator/TestFlight pass exists for this claim** — same
   caveat 838 already flagged for the duo tile in general. Rotation working
   is a strong code-level inference (config + no runtime lock + aspect-
   ratio-driven layout + no platform gate), but iOS-specific native
   rotation edge cases (e.g. `RTCView`/`AVCaptureSession` orientation
   metadata, camera preview staying correctly oriented rather than just the
   container resizing) are a known class of bug that only reproduces on a
   real device and cannot be ruled out by grep. Flagging as unverified, not
   as a known failure.

3. **Carried forward from 838, still open, adjacent to rotation:**
   `duoMatchClusterWide.bottom: 12` (landscape Next/Report/Stop/Friends
   cluster, `liveStyles.ts`) has zero safe-area inset handling. If rotation
   works as expected, this cluster will render 12px from the true landscape
   edge on a notched/Dynamic-Island iPhone, which is where iOS's Home
   Indicator lives in landscape (HIG-mandated clear zone) — Android has no
   equivalent constraint at that edge. Not a "does rotation happen" blocker,
   but a "is the post-rotation chrome usable" risk in the same feature area.

## Files touched
None — read-only critic per `OWN: none` / `Must not: edit product code, eas
build`.

## Verify commands run
- `grep -n "orientation" mobile/app.json mobile/app.config.js mobile/eas.json`
- `git log -p --follow -- mobile/app.json | grep -n "orientation"` and
  `git diff -- mobile/app.json` (confirms committed-vs-working-tree gap)
- `git branch --show-current`, `git log --oneline -1`, `git status --short
  | wc -l`
- `find mobile -maxdepth 2 -iname ios -o -iname "*.xcodeproj"` (confirms
  managed/CNG workflow, no stale native project)
- `grep -rn "ScreenOrientation|screen-orientation|lockAsync|orientationLock"
  mobile/src mobile/app.json mobile/app.config.js mobile/package.json`
- `grep -n "Platform" mobile/src/live/LiveStageVideo.tsx` (0 hits, re-
  verified independently of 838)
- `grep -n "Platform" mobile/src/live/liveStyles.ts` (4 hits, all unrelated
  bottom-bar padding, none near `youTileDock`)
- Read `LiveStageVideo.tsx:1690-1720` (you-tile render block),
  `liveStyles.ts:393-416` (`youTileDock`/`youTileDockWide`),
  `LiveStageVideo.tsx:660-700, 840-842` (splitWide/Dimensions logic),
  `mobile/src/live/VideoView.tsx` in full
- Read `docs/IOS_DUO.md`, `tasks/admin-queue/blocked/840-ios-duo-
  testflight.md`, `tasks/admin-queue/done/838-ios-duo-critic-RESULT.md`,
  `tasks/admin-queue/done/841-ios-duo-mic-rail-RESULT.md` for chain context
- `ls mobile/assets/store/ios/` + grep for existing landscape/rotate copy
  in `WHAT-TO-TEST.md` (none yet — 840 still blocked, so that doc hasn't
  been written)
- No `tsc`/device run — task scope is read-only.

## Connect risk
none — no files edited; no MediaSession/ICE/hub touched.

Not invented: no TestFlight run, no MULTI_PASS, no `product.ok` claimed —
the "yes, should rotate" conclusion above is static code evidence plus one
explicit operational caveat (uncommitted diff), not a device confirmation.

COMPLETE
