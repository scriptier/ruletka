# 535 — Android tap-face partner actions — second critic RESULT

## Status
FIX — routing/target-resolution is now correct (big improvement over the 532 critic
pass, which found Report/Block throwing for everyone), but the More sheet itself
still does not know which person was tapped, so the two UI-facing DONE WHEN items
(name-in-title, hide debate on the extra sheet) are unmet. Read-only review only;
no product code touched.

Note: `knowledge/specs/2026-08-15-android-partner-actions.md` (cited by this task
and by the 532 critic before it) does not exist in this worktree
(`find knowledge -iname '*android-partner-actions*'` → no hits; `knowledge/specs/`
itself is absent, only `knowledge/wiki` and `knowledge/raw` exist). Reviewed
against the `## Check` list in `tasks/admin-queue/running/535-android-actions-critic.md`
instead, since the spec doc is unavailable.

## Verdict: FIX

### 1. 1v1 tap partner opens sheet for primary — PASS
- Swipe path: `SwipeSkipOverlay onTap={onSelectPartner ? peelOrSelectPrimary : undefined}`
  — `mobile/src/live/LiveStageVideo.tsx:1119`.
- Non-swipe fallback: `remoteTapLayer` `Pressable.onPress` calls `peelOrSelectPrimary()`
  (distinguishing single tap from the 320ms double-tap-reblur window) —
  `mobile/src/live/LiveStageVideo.tsx:1199-1216`.
- `peelOrSelectPrimary` (`LiveStageVideo.tsx:854-863`) calls `onSelectPartner("primary")`,
  which `live.tsx:7386-7391` handles with `setActionSlot("primary"); setMoreOpen(true)`.

### 2. 3-way tap extra0/extra1 opens sheet for THAT person — PARTIAL FAIL (name in title missing)
- Routing is correct: `ExtraRemoteTile onPress={() => peelOrSelectExtra("extra0")}`
  (`LiveStageVideo.tsx:1253`) and `("extra1")` (`LiveStageVideo.tsx:1279`);
  `peelOrSelectExtra` (`LiveStageVideo.tsx:865-877`) calls `onSelectPartner(slot)` when
  present (falls back to `onToggleFocusExtra()` only if no `onSelectPartner` prop —
  not the case here), so **tapping an extra face no longer just toggles focus** (532's
  finding #2 is fixed).
- `live.tsx:7386-7391` sets `actionSlot`/`actionSlotRef` to the tapped slot and opens
  the sheet — so the sheet *does* open scoped to the right person internally.
- **But** `<LiveMoreSheet>` is instantiated at `live.tsx:8148-8298` with no `actionSlot`
  (or any per-person) prop at all — full prop list checked, `actionSlot` is absent.
  `mobile/src/live/LiveMoreSheet.tsx` — `LiveMoreSheetProps` (lines 7-58) has no
  `actionSlot` field, and the component (lines 60-211) renders no title/name text
  anywhere. `grep -n actionSlot mobile/src/live/LiveMoreSheet.tsx` → no hits.
  **The sheet is visually identical regardless of which face was tapped — no name in
  title, exactly as the L0 script's own new assert expects and fails on.**

### 3. Extra sheet hides Find 3rd / debate / browse; report/block keep-pair, no next() — PARTIAL FAIL (debate row)
- Report/block keep-pair: **PASS**. `doBlockOnly()` (`live.tsx:6422-6458`) and
  `doReport()` (`live.tsx:6460-6505`) both end with
  `if (finishExtraSafetyKeepPair(...)) return;` before the `next()` call, so extra
  report/block correctly calls `finishExtraSafetyKeepPair` → `dropExtraKeepPrimaryRef.current(dropSlot, why)`
  (`live.tsx:6335-6345`) and **does not** call `next()` for extras. 1v1 (primary
  slot) falls through to `next()` as before — correct.
- Find 3rd / browse-together: hidden on the extra sheet today, but only as a side
  effect of the pre-existing `extraPeerCount === 0` gate (`LiveMoreSheet.tsx:136-148`),
  not because the sheet knows an extra's face was tapped — same gate applies
  identically whether the primary or an extra sheet is open in a 3-way. Functions
  correctly for the current 1v1-vs-3-way cases only because there's no scenario yet
  where extraPeerCount could be 0 while an extra-slot sheet is open.
- **Debate row: FAIL.** `LiveMoreSheet.tsx:163-186` renders the debate `Pressable`
  unconditionally — no `extraPeerCount` or `actionSlot` gate at all (same gap 532
  already flagged). Tapping an extra face and opening "debate" from that sheet still
  shows/fires the same debate-invite control as the primary sheet.

### 4. `actionSlot` / `actionSlotRef` / `extraPartnerActionTarget` declared, no undeclared-identifier throw on Report — PASS
- `actionSlot`/`setActionSlot` state: `live.tsx:516-518`. `actionSlotRef`: `live.tsx:519-520`,
  kept in sync (`actionSlotRef.current = actionSlot`).
- `extraPartnerActionTarget` is defined **locally** in `live.tsx:257-284` (not
  imported from `matchContinuity.ts` — comment at `live.tsx:253-256` explicitly
  flags this as "local fallback so report/block compiles while that hop is
  mid-flight"). `matchContinuity.ts` has no such export
  (`grep -n extraPartnerActionTarget mobile/src/live/matchContinuity.ts` → no hits),
  which is exactly why the L0 script's new assert fails (`FAIL matchContinuity.ts
  extraPartnerActionTarget — missing export function extraPartnerActionTarget`).
  This is a real gap vs. the check's literal wording ("declared **and imported**")
  and vs. the L0 assert added in task 534, but it is **not a crash risk**: the local
  function is self-contained, not name-shadowed by any import (`live.tsx:110-119`
  imports only `shouldSkipPrimaryStartCall`, `shouldKeepTrioOnCallEnded`,
  `routeInboundSignalTarget`, `routeInboundNoCamSlot`, `shouldIgnorePrimaryNoCam`,
  `shouldRehomePrimaryNoCam`, `latchThirdJoinerPeerIds` from `matchContinuity` — no
  `extraPartnerActionTarget`), so there's no duplicate-declaration or
  undefined-symbol risk.
- `dropExtraKeepPrimaryRef` (532's other undeclared-identifier finding) is now
  properly declared (`live.tsx:351-353`) and assigned
  (`live.tsx:2052: dropExtraKeepPrimaryRef.current = dropExtraKeepPrimary`) before
  `finishExtraSafetyKeepPair` reads it (`live.tsx:6339`).
- `npx tsc --noEmit -p .` in `mobile/` shows **zero** `TS2304`/`TS2552` errors for
  `actionSlotRef`, `setActionSlot`, `extraPartnerActionTarget`, or
  `dropExtraKeepPrimaryRef` (the four undeclared-identifier errors 532 reported are
  gone). Remaining `tsc` errors are pre-existing/unrelated: missing type decls for
  `expo-keep-awake` / `react-native-view-shot` / `expo-clipboard`, dynamic-import
  module-flag noise, and a handful of "not callable" / overload errors in unrelated
  no-cam/nocam-slot code (`live.tsx:5955-6017`, `6211`) and template-version/
  last-hint code (`7574`, `7641`) — none touch the tap-a-face feature.

### 5. First VideoView `key="live-first-remote"` stays; no MediaSession/hunt remount — PASS
- `mobile/src/live/LiveStageVideo.tsx:907` — first `VideoView` still keyed
  `"live-first-remote"`. `matchContinuity.ts` (`shouldSkipPrimaryStartCall`,
  `shouldKeepTrioOnCallEnded`, `routeInboundSignalTarget`, etc.) is untouched by this
  feature's changes — no remount/MediaSession regression found.

## Files touched
- `tasks/admin-queue/done/535-android-actions-critic-RESULT.md` (this file only)

## Verify commands run
```
node mobile/src/live/matchContinuity.test.mjs
  → matchContinuity.test.mjs ok

node mobile/scripts/verify-match-ux.mjs
  → L0 done: 50 ok, 2 fail
    FAIL LiveMoreSheet actionSlot — missing actionSlot
    FAIL matchContinuity.ts extraPartnerActionTarget — missing export function extraPartnerActionTarget

cd mobile && npx tsc --noEmit -p .
  → no TS2304/TS2552 undeclared-identifier errors for actionSlotRef, setActionSlot,
    extraPartnerActionTarget, or dropExtraKeepPrimaryRef (532's 6 crash-causing
    errors are resolved); remaining errors are pre-existing/unrelated (see #4 above)
```

## Connect risk
low — this feature is off the ICE/offer/MediaSession path; the surviving gaps
(no name-in-title, debate row not slot-gated on the extra sheet) are UX polish
issues, not crashes or safety-flow regressions. Report/Block no longer throws
(532's high-risk finding is fixed) and correctly keeps the pair for extras without
calling `next()`.

## Recommendation
Two small, scoped fixes would close this out:
1. Pass `actionSlot` (or a resolved partner name/slot label) into `<LiveMoreSheet>`
   at `live.tsx:8148` and render it as a title in `LiveMoreSheet.tsx`.
2. Gate the debate row (`LiveMoreSheet.tsx:163-186`) the same way
   find-3rd/browse/invite already are (`extraPeerCount === 0` and/or
   `actionSlot === "primary"`).
Whether to also move `extraPartnerActionTarget` into `matchContinuity.ts` (to match
the check's "declared and imported" wording and satisfy the L0 assert) is a style
call — the current local fallback is functionally safe.

COMPLETE
