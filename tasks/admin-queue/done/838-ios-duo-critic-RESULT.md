# RESULT: 838-ios-duo-critic

## Status
COMPLETE (read-only static-analysis critic — no iPhone/simulator available;
findings are grep/code-read evidence, not an on-device TestFlight pass).

## Spec note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(same gap noted by prior critic 828); read from main tree instead:
`/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`.
DONE WHEN: `Platform.OS` iOS branches exist where Android has chrome; no
MediaSession/ICE/pool>0 changes. App version confirmed: `mobile/app.json` →
`"version": "0.1.477"`.

## Scope
Read only `mobile/src/live/LiveStageVideo.tsx` (the `youTileDock` /
`youTileDockWide` browser-duo 1v1 two-tile path) and `mobile/src/live/liveStyles.ts`,
plus the call site in `mobile/app/live.tsx` that wires `browserDuo`.

## Method
- `grep -n "Platform" mobile/src/live/LiveStageVideo.tsx` → **0 hits**.
- `grep -n "Platform" mobile/src/live/liveStyles.ts` → only 8 hits, all in an
  unrelated bottom-bar/button block (lines 1940-2025, `paddingVertical`/
  `minHeight` `Platform.select`), none near `youTileDock` (393-420) or
  `duoMatchCluster`/`duoMatchBtn` (421-452).
- `grep -n "insets|SafeArea" mobile/src/live/LiveStageVideo.tsx` → **0 hits**.
- `grep -n "insets|SafeArea" mobile/src/live/liveStyles.ts` → only comments
  (278, 294, 316, 598) saying insets for *other* elements (stage HUD/dock/
  strip) are applied **at runtime from live.tsx**, not baked into the style.
- `grep -n "insets\." mobile/app/live.tsx` → 6 call sites (8060, 8272, 8663,
  8765, 8842, 8844) threading `insets.top`/`insets.bottom` into HUD/dock/bar
  props — **none of them touch the duo two-tile** (`youTileDock`,
  `duoMatchCluster`, `duoMatchClusterWide`).
- Confirmed `browserDuo={isBrowserLayout}` (`live.tsx:8022`) is a **user
  pref** (`prefs.liveLayout`, default `"browser"`, `live.tsx:497,2337-2338`),
  not `Platform.OS`-gated — same duo layout ships to iOS and Android alike.
- Cross-read `828-ios-parity-critic-RESULT.md`, `837-ios-duo-watermark-RESULT.md`,
  `840-ios-duo-testflight.md` (blocked), `841-ios-duo-mic-rail.md` (running)
  for prior duo-specific findings.

## Remaining iOS FAIL vs Android 0.1.477 duo

1. **No safe-area inset handling anywhere in the duo two-tile chrome**
   (`youTileDock`/`youTileDockWide`, `duoMatchCluster`/`duoMatchClusterWide`,
   `liveStyles.ts:393-452`). Every value is a flat absolute constant
   (`bottom: 0`, `bottom: 12`, `bottom: "52%"`) with zero `Platform.select`
   and zero inset prop threaded in from `live.tsx` — unlike the stage HUD /
   dock / strip in the same file, which explicitly receive `insets.top`/
   `insets.bottom` from `live.tsx` (6 call sites, e.g. `partnerFlagTopInset={
   Math.max(insets.top, 4) + 44}` at `live.tsx:8060`). Concretely:
   `duoMatchClusterWide.bottom: 12` (landscape Next/Report/Stop/Friends
   cluster) sits only 12px from the true screen edge. Android's gesture/
   3-button nav has no equivalent "no-touch" reserved zone at that edge;
   iOS's Home Indicator (HIG-mandated ~21-34pt clear zone, and it moves to
   the long edge in landscape) is not compensated for at all, so on a
   notched/Dynamic-Island iPhone in landscape the duo action cluster is a
   real candidate for edge crowding/occlusion that Android does not have.
   Same asymmetry class as the already-flagged 828 finding #3 (gift-chip
   hit target) — iOS HIG requirement, not a shared bug.

2. **`BrandWatermark` (task 837) can render fully hidden behind the you-tile
   when duo is active — but this is a shared bug, not iOS-specific.** Noting
   it because it touches the exact seam this task was asked to check.
   `BrandWatermark` mounts inside the **main tile** (`firstTileStyle`, full
   stage height in 1v1 — `splitStage` is false since `multiRemote` is
   false), so `onRootLayout` measures full stage height `h`, and
   `settleTyForStage` parks it at `0.56·h` (portrait) — assuming self is
   still the old floating `DraggablePip`, per 837's own note ("mobile app
   has no true left/right or top/bottom split tile for 1v1 … self is a
   small draggable DraggablePip"). That assumption is stale for
   `browserDuo`: `youTileDock` is a real, opaque, fixed 50%-height tile
   (`liveStyles.ts:393-405`, `backgroundColor:"#050608"`, `zIndex:40`,
   `top` at exactly 50%) sitting well above `BrandWatermark`'s `zIndex:6`.
   0.56·h is *below* the tile's 0.50·h top edge, so the mark (and its glow/
   spin) settles entirely under the opaque you-tile and is invisible for
   the whole "matched" duration whenever `browserDuo` is on (default pref).
   Confirmed no `Platform.OS` gate anywhere in `BrandWatermark.tsx` either
   (only `android`/`ios`/`default` shadow-vs-elevation cosmetic branches,
   unrelated to seam math) — repros identically on Android, so it is **not**
   an "iOS FAIL vs Android" item for this ticket's Done criteria, just a
   real product bug adjacent to the files this task named. Flagging for
   whichever backlog task owns `BrandWatermark.tsx` (837 already closed
   COMPLETE, so this is a regression against that fix's assumption, not
   something 837 could have seen at the time it landed).

3. **No code-level iOS/Android divergence found inside `youTileDock`/
   `duoMatchCluster` proper.** Because neither file gates this path on
   `Platform.OS`, iOS and Android receive byte-identical layout math for the
   duo two-tile split itself. The one remaining risk needing a device, not a
   grep, is native `RTCView` compositing: the file's own comments describe
   `zOrder` as an **Android SurfaceView-only** compositing concept that iOS
   ignores harmlessly (same conclusion the 828 critic reached for
   `VideoView.tsx`/832) — so `mainZOrder`/`pipZOrder` should not cause an
   iOS-only stacking bug in the duo tile, but this is unverified without a
   TestFlight/simulator pass.

## Files touched
None — read-only critic per `OWN: none` / `Must not: edit product code`.

## Verify commands run
- `grep -n "Platform" mobile/src/live/LiveStageVideo.tsx`
- `grep -n "Platform" mobile/src/live/liveStyles.ts`
- `grep -n "insets\|SafeArea" mobile/src/live/LiveStageVideo.tsx`
- `grep -n "insets\|SafeArea" mobile/src/live/liveStyles.ts`
- `grep -n "insets\." mobile/app/live.tsx`
- `grep -n "browserDuo\|isBrowserLayout\|setLiveLayout" mobile/app/live.tsx`
- Read `youTileDock`/`youTileDockWide`/`duoMatchCluster`/`duoMatchClusterWide`
  style block (`liveStyles.ts:388-452`) and the corresponding render block
  (`LiveStageVideo.tsx:1640-1714`).
- Read `BrandWatermark.tsx` in full and its one mount site
  (`LiveStageVideo.tsx:1330-1336`, inside `firstTileStyle`).
- Cross-read `828`, `837`, `840`, `841` task/RESULT files for prior duo
  findings (no duplicate — 837 fixed the *seam math*, not the you-tile
  z-order collision that postdates/coexists with it).
- No `tsc`/device run — task scope is read-only.

## Connect risk
none — no files edited; no MediaSession/ICE/hub touched.

Not invented: no TestFlight run, no MULTI_PASS, no `product.ok` claimed — all
findings above are static code evidence only.

COMPLETE
