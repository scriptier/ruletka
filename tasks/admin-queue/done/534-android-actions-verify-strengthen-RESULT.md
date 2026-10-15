# 534 — Android tap-face: strengthen verify-match-ux asserts — RESULT

## Status
COMPLETE

## Files touched
- `mobile/scripts/verify-match-ux.mjs` (only)

## What changed
Strengthened the "Tap-a-face partner actions (task 531)" block so it fails on
dead wiring, not just on missing identifiers:

1. **onSelectPartner real call sites** — new check requires a literal
   `onSelectPartner("primary")` call AND a slot-forwarding function
   (`const fn = (slot: ...) => { ... onSelectPartner(slot) ... }`) that is
   itself invoked with `"extra0"` and `"extra1"`. Passing only the
   `onSelectPartner?: (slot: ...) => void` prop type no longer satisfies this.
2. **peelOrSelectPrimary call site** — requires `peelOrSelectPrimary` (or a
   direct `onSelectPartner("primary")`) to appear inside a `SwipeSkipOverlay`
   `onTap={...}` or a `Pressable` `onPress={() => { ... }}` block — i.e. an
   actual call site, not just the function definition.
3. **live.tsx `onSelectPartner=` prop** — sliced the `<LiveStageVideo ... />`
   JSX block (from `<LiveStageVideo` to the matching `\n        />`) and
   confirmed `onSelectPartner=` is passed inside it, not just referenced
   elsewhere in the file.
4. **matchContinuity.ts exports `extraPartnerActionTarget`** — new check for
   `export function extraPartnerActionTarget`. This sibling has not landed
   yet, so it currently FAILs by design (task explicitly allows this).
5. Kept the existing `key="live-first-remote"` assert unchanged.

All new asserts are additive; none of the pre-existing 531 asserts were
weakened or removed.

## Verify commands run
```
node mobile/scripts/verify-match-ux.mjs
```
Output: `L0 done: 50 ok, 2 fail`

The 2 fails are pre-existing sibling gaps, not caused by this task:
- `LiveMoreSheet actionSlot` — missing actionSlot (sibling task, not landed)
- `matchContinuity.ts extraPartnerActionTarget` — missing export (sibling
  task, not landed — new assert #4 above)

All new dead-wiring asserts (onSelectPartner real call sites,
peelOrSelectPrimary call site, live.tsx onSelectPartner= prop) currently
pass against the landed `LiveStageVideo.tsx` / `live.tsx` code, confirming
the tap-a-face wiring from task 531 is real (not stub/dead code).

## Connect risk
none — script-only change, no runtime/product code touched.

COMPLETE
