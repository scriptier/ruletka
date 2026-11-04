# RESULT: 820-ios-parity-bottom-bar

## Status
COMPLETE (best-effort, static-analysis only — no physical iPhone available to this agent; needs Grok/human device smoke to confirm pixel fit).

## Context / note
`knowledge/specs/current-ios-parity.md` (cited in the task) does not exist in this repo — only `knowledge/specs/2026-08-20-ru-reach.md` is present. Proceeded from the task's own Goal/OWN/Must not/Done checklist per the CLAUDE.md fallback ("Prefer knowledge/specs/* DONE WHEN when cited" — not found, so used the task file itself).

Also note: `mobile/src/live/LiveBottomBar.tsx` and `mobile/src/live/liveStyles.ts` (and the whole `mobile/src/live/` dir) show as untracked (`??`) on this branch (`claude/p0-connectivity`) even though they exist in other branches' history — a pre-existing worktree/branch state, not something this task touched or fixed.

## What changed
Confirmed the outer bottom-bar container (`app/live.tsx`, out of OWN scope, untouched) already applies `paddingBottom: Math.max(insets.bottom, 10)` to the wrapper around `LiveBottomBar`, so raw home-indicator clearance at the container edge was already correct on both platforms. The remaining gaps, within OWN scope:

1. **`mobile/src/live/liveStyles.ts`**
   - Added `Platform` import.
   - `btn`, `btnStopFace`, `btnNext`, `btnIcon`: `paddingVertical` / `minHeight` now use `Platform.select({ ios: ..., default: ... })`, tightened a few points on iOS (min height 44pt, Apple HIG's own minimum tap target, vs Android's 48dp). This shrinks the two-row control block's total footprint on iOS so it has less chance of crowding the partner tile above while every control stays ≥44pt tappable.

2. **`mobile/src/live/LiveBottomBar.tsx`**
   - Imported `Platform` (react-native) and `useSafeAreaInsets` (react-native-safe-area-context, already a project dependency, used elsewhere in `live.tsx`).
   - Component now reads `insets` and computes `iosHomeIndicatorGap` (6pt, iOS only, only when `insets.bottom > 0` i.e. a physical home-indicator device) — a small, non-duplicative breathing-room nudge (does not re-add the full inset the parent already contributes).
   - Applied that gap as extra `paddingBottom` on the **icon row** only (mic/flip/mute/blur/more/settings) — the row physically closest to the home indicator — so it reads as clearly above the pill rather than flush against it. Android is unaffected (`iosHomeIndicatorGap` is `0`).
   - `idleBeforeStart` gating logic (no Stop/Next before Start is pressed) was not touched.

Diamond idle-Start position (`idleArcadeWrap`, percentage-based `top: "70%"`) is rendered from `LiveStageVideo.tsx`, which is **out of OWN scope** — left untouched. If device smoke shows the diamond itself (not the bottom bar) is the thing overlapping the home indicator/partner tile on iPhone, that's a follow-up task against `LiveStageVideo.tsx` / `IdleArcadeStart.tsx`, not this one.

## Files touched
- `mobile/src/live/liveStyles.ts`
- `mobile/src/live/LiveBottomBar.tsx`

## Verify commands run
- `npx tsc --noEmit` (mobile/) — pre-existing unrelated errors only (missing native modules in this worktree's `node_modules`, e.g. `expo-clipboard`, `expo-keep-awake`, and pre-existing `live.tsx` issues); **zero** errors in either touched file.
- `node scripts/verify-match-ux.mjs` — 139 ok / 0 fail, including:
  - `OK LiveBottomBar hides Stop/Next until Start`
  - `OK Idle Start sits on brand diamond (~70% of 720×1096 loop)`
  - `OK LiveBottomBar full-width 3D Stop/Next (PiP on video, not in bar)`

## Connect risk
none — no changes to MediaSession, hub, ICE/TURN, offer/answer, or `live.tsx`. Pure style/layout diff scoped to `LiveBottomBar.tsx` + `liveStyles.ts`.

COMPLETE
