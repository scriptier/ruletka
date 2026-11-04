# RESULT: 828-ios-parity-critic

## Status
COMPLETE (read-only static-analysis critic — no iPhone/simulator available to
this agent; findings are grep/code-read evidence, not an on-device TestFlight
pass).

## Spec note
`knowledge/specs/current-ios-parity.md` does not exist in this worktree
(`knowledge/specs/` here only has `2026-08-20-ru-reach.md`). Read from the
main tree instead: `/home/drakosik/freenet-roulette/knowledge/specs/current-ios-parity.md`.
Same DONE WHEN as prior 82x chain: `Platform.OS` iOS branches where Android
has chrome; no MediaSession/ICE/pool>0 changes.

App version confirmed: `mobile/app.json` → `"version": "0.1.477"` (task asked
to compare against **0.1.477, not 475** — confirmed correct build).

## Method
Read the 3 files named in the task (`LiveBottomBar.tsx`, `IdleArcadeStart.tsx`,
`permissions/media.ts`), ran `grep -rn "Platform.OS" mobile/src mobile/app`
(42 hits), then cross-checked every prior `82x-ios-parity-*` task in
`tasks/admin-queue/{pending,done}` against current code to see which are
genuinely still open vs. already fixed.

## Already fixed (done/ has RESULT, code confirms the branch exists)
- `LiveBottomBar.tsx:143-144` — `iosHomeIndicatorGap` (6pt extra above icon
  row when `insets.bottom>0`). (820)
- `IdleArcadeStart.tsx:22-25` — `iosLift` nudges the Start diamond up on
  notched iPhones. (821)
- `PartnerBlurVeil.tsx:49,303` — `IOS_SOFT_BLUR` / Android-only blur branch. (822)
- `PartnerIdentityDock.tsx:331` — iOS `placement==="top"` branch. (823)
- `settings.tsx:1206,1271,1679,1724` — Download-APK row Android-gated,
  `buildLabel()` reads `ios.buildNumber` on iOS. (825)
- `LiveMoreSheet.tsx:139,143` — `iosScrollInset` bottom padding. (826/827 area)
- `permissions/media.ts:83-94,148-167` — full iOS `AVCaptureDevice`
  query/request branch via `react-native-webrtc` permissions bridge; silent
  fast-path (`hasMediaPermissions`) and request path both correctly iOS-gated.
  Already at parity with Android — no gap found here.

## Remaining iOS FAIL lines vs Pixel 0.1.477

1. **`mobile/app/rules.tsx`** (task 829, still open) — `grep -n
   "insets\|SafeArea\|Platform" mobile/app/rules.tsx` returns only the
   existing `Platform.OS === "android"` branch at line 105
   (`declineUnder18` → `BackHandler.exitApp()` vs `Linking.openURL`). **No
   `useSafeAreaInsets` anywhere in the file**; `root: { padding: 24, gap: 14
   }` (rules.tsx:194) is a flat, non-inset-aware padding used as the
   `ScrollView` `contentContainerStyle`. On a notched/Dynamic-Island iPhone
   the 18+ gate / permission-rationale content can render under the notch —
   Android has no equivalent obstruction so this asymmetry is real.

2. **`mobile/app/index.tsx`** (task 830, still open) — `grep -n
   "insets\|SafeArea\|Platform" mobile/app/index.tsx` returns **zero
   matches**. Home screen (reached via Back from Live) has no iOS-specific
   safe-area or Platform branch at all; relies entirely on the Stack header
   for top clearance. Not yet audited/fixed.

3. **`mobile/src/live/LiveGiftBar.tsx` + gift chip styles** (task 831, still
   open) — no `Platform.OS`/insets code in `LiveGiftBar.tsx` itself (grep
   returned nothing). Concrete gap: compact gift chips (used inside
   `LiveMoreSheet`, `compact={true}`) use `giftChipCompact`
   (`liveStyles.ts:1650-1655`: `paddingVertical: 4`) + `giftEmojiCompact`
   (18pt) + `giftCostCompact` (10pt) ≈ **~42pt tall**, under Apple's 44×44pt
   minimum tap target, and the `TapPressable` at `LiveGiftBar.tsx:170-188`
   has **no `hitSlop`** (unlike every button in `LiveBottomBar.tsx`, which
   sets `hitSlop={{top:6-8,...}}` throughout). Android has no equivalent HIG
   requirement, so this is iOS-specific tech debt, not a shared bug.

4. **`mobile/src/live/VideoView.tsx`** (task 832, still open per queue, but
   code looks already correct) — `objectFit="cover"` (line 63) is hardcoded
   platform-neutral (no `Platform.OS` branch, and none needed — `zOrder` is
   an Android SurfaceView-compositing concept per the file's own comment
   block; iOS RTCView uses normal UIView stacking and ignores it
   harmlessly). No code gap found by reading; flagging only because it can't
   be visually confirmed without an iPhone/simulator — worth a human
   TestFlight glance to close 832 rather than a further code task.

5. **`mobile/app/_layout.tsx`** (task 834, still open per queue, but code
   looks already correct) — `headerShown: false` on the `live` Stack.Screen
   (line 859) and `BootToLiveOnce`/back-to-Home logic (lines 783-802) are
   already shared, non-Platform-gated code, so "iOS stack headerShown false
   on live" already holds. No `Platform.OS` branch missing that I could
   find. Same caveat as #4: no device to confirm swipe-back gesture feel
   matches Android's hardware-back Home redirect.

## Files touched
None — read-only critic per task `OWN: none` / `Must not: edit product code`.

## Verify commands run
- `grep -rn "Platform.OS" mobile/src mobile/app` (42 hits, listed above)
- `grep -n "insets\|SafeArea" mobile/app/rules.tsx mobile/app/index.tsx`
  (zero hits in both — confirms findings #1/#2)
- `grep -n "objectFit\|zOrder\|RTCView" mobile/src/live/VideoView.tsx`
- Cross-read of `tasks/admin-queue/{pending,done}/82*-ios-parity-*.md` and
  their RESULT files to separate already-fixed vs. still-open items.
- No `tsc`/test run — task scope is read-only research, no code changed.

## Connect risk
none — no files edited; no MediaSession/ICE/hub touched.

Not invented: no TestFlight run, no MULTI_PASS, no `product.ok` claimed —
all findings above are static code evidence only.

COMPLETE
