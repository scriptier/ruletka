# 532 — Android tap-face partner actions — critic RESULT

## Status
FIX — feature is not wired up, and the plumbing that exists breaks the pre-existing
Report/Block flow for everyone (1v1 included), not just 3-way extras. Read-only
review only; no product code touched.

## Verdict: FIX

Spec: `knowledge/specs/2026-08-15-android-partner-actions.md`

### 1. `mobile/app/live.tsx` — undeclared identifiers, Report/Block now throws
- `resolvePartnerTargetId()` (line 6252) reads `actionSlotRef.current` — `actionSlotRef`
  is never declared anywhere in the file (no `useRef`, no destructure). `tsc --noEmit`
  confirms: `TS2552: Cannot find name 'actionSlotRef'` at 6252, 6293, 6298, and
  `TS2304: Cannot find name 'setActionSlot'` at 6299.
- Same function calls `extraPartnerActionTarget({ extras, slot })` (line 6255) — this
  symbol is not imported anywhere in `live.tsx` and does not exist anywhere under
  `mobile/src/live/` (`grep -r extraPartnerActionTarget mobile/src` → no hits).
  `tsc`: `TS2304: Cannot find name 'extraPartnerActionTarget'`.
- `finishExtraSafetyKeepPair()` (line 6292–6302, the "extra report/block keeps the
  pair" logic from DONE WHEN #3) reads `dropExtraKeepPrimaryRef.current` (line 6296)
  — also never declared (the real local is `dropExtraKeepPrimary`, a plain `const`,
  not a ref). `tsc`: `TS2304: Cannot find name 'dropExtraKeepPrimaryRef'`. This
  function is additionally dead code — grep shows no caller anywhere in the file.
- **Blast radius:** `resolvePartnerTargetId()` is called unconditionally at the top
  of `openReport()` (6321), `doBlockOnly()` (6380), `doReport()` (6417), and one more
  call site (6565) — i.e. every existing Report/Block path, 1v1 or multi. Since
  `actionSlotRef` is read on the very first line of that function, any tap on
  Report/Block/reason-select now throws a `ReferenceError` at runtime (Babel/Metro
  won't catch this ahead of time — RN doesn't type-check on build). This is a
  regression of previously-working functionality, not just an incomplete new feature.
- `<LiveStageVideo>` is instantiated at line 7179 with no `onSelectPartner` prop —
  grep for `onSelectPartner=` in `live.tsx` returns nothing. So even the parts of
  `LiveStageVideo` that *are* written for this feature never receive a callback from
  the screen.

### 2. `mobile/src/live/LiveStageVideo.tsx` — new code path defined but never wired
- `peelOrSelectPrimary` (line 854) and `peelOrSelectExtra` (line 865) are the only
  places that would call `onSelectPartner`. Neither is referenced anywhere else in
  the file (grep confirms 2 hits total = their own definitions) — dead code.
- The primary tile's actual tap surfaces are `SwipeSkipOverlay` (when `swipeActive`,
  ~line 1114) and the fallback `remoteTapLayer` Pressable (~line 1198) — both only
  wire double-tap-reblur + long-press-report, no single-tap handler calls
  `peelOrSelectPrimary` or `onSelectPartner`. **Tapping the 1v1 partner face today
  does nothing** (DONE WHEN #1 not met — sheet still only opens from bottom ⋯).
- `ExtraRemoteTile` `onPress` is wired inline at the `<ExtraRemoteTile>` call sites
  (~line 1251 for extra0, ~line 1285 for extra1) and calls `onToggleFocusExtra()`
  directly — it does not call `peelOrSelectExtra` or check `onSelectPartner` at all.
  **Tapping an extra face just toggles focus**, same as before this task (DONE WHEN
  #2 not met).
- Positive: first `VideoView` still `key="live-first-remote"` (line 907), lock/keep
  logic (`lockFirstRemote`, `shouldSkipPrimaryStartCall` et al in
  `matchContinuity.ts`) is untouched by this feature — no remount/MediaSession
  regression from what was reviewed (item 4 of Check list is clean).

### 3. `mobile/src/live/LiveMoreSheet.tsx` — no per-person title/slot
- Props/labels have no `actionSlot`, no partner-name title field at all — the sheet
  is identical regardless of which face (if any) was tapped, so "extra sheet: no
  Find 3rd / debate / browse-together, name in title" (DONE WHEN #2/#3) cannot be
  satisfied even once the wiring above is fixed. `findThird`/`browseTogether`/
  `inviteFriend` rows are gated on `extraPeerCount === 0` (i.e. "no 3rd exists"),
  not on which slot's sheet is open — so today they already correctly hide once a
  3rd is present, but `debate` is not gated on slot/extraPeerCount at all and would
  still appear on an extra-person sheet.

## Files touched
- `tasks/admin-queue/done/532-android-partner-actions-critic-RESULT.md` (this file only)

## Verify commands run
```
node mobile/src/live/matchContinuity.test.mjs        # ok
node mobile/scripts/verify-match-ux.mjs               # L0 done: 46 ok, 2 fail
  FAIL LiveMoreSheet actionSlot — missing actionSlot
  FAIL live.tsx actionSlot — missing actionSlot
cd mobile && npx tsc --noEmit -p .                     # corroborates dead refs:
  app/live.tsx(6252,18): TS2552 Cannot find name 'actionSlotRef'
  app/live.tsx(6255,22): TS2304 Cannot find name 'extraPartnerActionTarget'
  app/live.tsx(6293,18): TS2552 Cannot find name 'actionSlotRef'
  app/live.tsx(6296,18): TS2304 Cannot find name 'dropExtraKeepPrimaryRef'
  app/live.tsx(6298,5):  TS2552 Cannot find name 'actionSlotRef'
  app/live.tsx(6299,5):  TS2304 Cannot find name 'setActionSlot'
```
(Unrelated pre-existing `tsc` noise from missing `expo-keep-awake` /
`react-native-view-shot` / `expo-clipboard` type declarations — this worktree has no
`node_modules` for those packages installed; not counted as findings.)

## Connect risk
high — not on ICE/MediaSession/offer path directly, but Report/Block is a
safety-critical control and currently throws for every call type (1v1 and 3-way)
due to the undeclared `actionSlotRef` read at the top of `resolvePartnerTargetId()`.
Should not ship as-is.

## Grep evidence (repo-wide)
```
grep -rn 'actionSlotRef\s*=\|const \[actionSlot' mobile/app/live.tsx   → no hits (never declared)
grep -rn 'extraPartnerActionTarget' mobile/src                          → no hits (never defined)
grep -n 'onSelectPartner=' mobile/app/live.tsx                          → no hits (never passed)
grep -n 'peelOrSelectPrimary\|peelOrSelectExtra' mobile/src/live/LiveStageVideo.tsx → only their own defs (854, 865)
grep -n 'finishExtraSafetyKeepPair' mobile/app/live.tsx                 → only its own def (6292); no caller
```

No MULTI_PASS invented — the above is drawn directly from `tsc`, `grep`, and the two
spec-listed eval scripts.

COMPLETE
