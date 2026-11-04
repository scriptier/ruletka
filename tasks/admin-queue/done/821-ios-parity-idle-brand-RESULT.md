# RESULT: 821-ios-parity-idle-brand

## Status
COMPLETE (best-effort, static-analysis only — no physical iPhone available to this agent; needs Grok/human device smoke to confirm pixel fit).

## Context / note
`knowledge/specs/current-ios-parity.md` (cited in the task) does not exist in this repo — only `knowledge/specs/2026-08-20-ru-reach.md` is present. Proceeded from the task's own Goal/OWN/Must not/Done checklist per the CLAUDE.md fallback.

This is the direct follow-up flagged by task 820 (`820-ios-parity-bottom-bar-RESULT.md`): "If device smoke shows the diamond itself ... is the thing overlapping the home indicator ... that's a follow-up task against LiveStageVideo.tsx / IdleArcadeStart.tsx." 820 fixed the bottom-bar container; this task covers the diamond Start button itself.

Also note: the whole `mobile/src/live/` dir (including the three OWN files) shows as untracked (`??`) on this branch (`claude/p0-connectivity`) — a pre-existing worktree/branch state, not something this task touched.

## What changed
Traced the render tree: `IdleArcadeStart` mounts inside `LiveStageVideo`'s `remoteFill` tile, itself inside `app/live.tsx`'s `stage` (or `stageBrowser` in the browser-dock layout). In the default flex layout, `stage` is a flex sibling of the bottom `bar` (which already pads its own outer edge by `insets.bottom`), so the diamond sits structurally above the home indicator there. But `stageBrowser` (used when `prefs.liveLayout === "browser"`) is `StyleSheet.absoluteFillObject` with a *floating* `browserDock` overlay — i.e. edge-to-edge, no structural safe-area clearance — so the percentage-positioned diamond (`idleArcadeWrap`, `top: "70%"`) has no guaranteed home-indicator/Dynamic-Island margin in that mode.

1. **`mobile/src/live/IdleArcadeStart.tsx`**
   - Imported `Platform` (react-native) and `useSafeAreaInsets` (react-native-safe-area-context, already a project dependency — same idiom `LiveBottomBar.tsx` uses, see 820).
   - Component now reads `insets` and computes `iosLift = Platform.OS === "ios" && insets.bottom > 0 ? -min(insets.bottom, 20) : 0` (0 on Android, 0 on home-button iPhones without a reserved indicator strip).
   - Applied `iosLift` as an extra `translateY` transform layered onto the existing `idleArcadeWrap` style (array-merge, `liveStyles.ts` itself untouched) so the whole floor/halo/button stack nudges up on notched iPhones — enough to clear the home indicator in the edge-to-edge browser-dock layout, small enough (≤20pt) to stay visually on the gold diamond artwork in the default layout where it was already correctly placed.
   - No change to `BrandWatermark.tsx` or `BrandLoadingLoop.tsx`: the watermark's 20s-rest spin loop (`HOLD_BETWEEN_SPINS_MS`) has no `Platform` branch — it's one shared timeline, so iOS and Android already run byte-identical spin cadence by construction. (The PC reference in `ui/live-brand.css` also documents a 20s rest / 22s total cycle, matching the mobile constant — the task's "30s" figure does not match any cadence found in this repo; treated as referring to "same as Android," which already holds structurally, not a literal value to set.)

## Files touched
- `mobile/src/live/IdleArcadeStart.tsx`

## Verify commands run
- `npx tsc --noEmit` (mobile/) — pre-existing unrelated errors only (missing native modules in this worktree's `node_modules`, e.g. `expo-clipboard`, `expo-keep-awake`, `react-native-gesture-handler`, and pre-existing `live.tsx`/`SwipeSkipOverlay.tsx` issues); **zero** errors touching `IdleArcadeStart.tsx`, `BrandWatermark.tsx`, `BrandLoadingLoop.tsx`, or the `react-native-safe-area-context` import.
- `node scripts/verify-match-ux.mjs` — 139 ok / 0 fail, including:
  - `OK Idle Start sits on brand diamond (~70% of 720×1096 loop)`
  - `OK LiveStageVideo imports + mounts BrandWatermark`
  - `OK idle brand video swipe starts search`

## Connect risk
none — no changes to MediaSession, hub, ICE/TURN, offer/answer, `live.tsx`, or `liveStyles.ts`. Pure component-level style diff scoped to `IdleArcadeStart.tsx`; `iosLift` is `0` on Android so the change is fully inert there.

COMPLETE
