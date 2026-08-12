# RESULT: 200-unit-identity-loc-empty

## Status
COMPLETE

## What changed
This worktree already had the 0.1.332 identity fix on disk (`formatLocLine`
with `hideIp`, `PartnerIdentityDock.tsx` with placeholder-name fallback),
matching the task's premise that the code fix already landed. Work here
locked it down with unit tests:

1. **`mobile/src/identity/formatLocLine.test.mjs`** — already present and
   covers items 1 and 2 from the task, unmodified:
   - empty geo → `formatLocLine({})` === `""` (not a pending string)
   - flag-only → non-empty loc line (EN and RU, incl. localized country)
   - `hide_ip` → always `""`, never invents country/city from cosmetic flag
   - stage HUD resolve helper: `hide_ip` → stable "Location hidden" label,
     never stuck on "Looking up location…"

2. **Extracted a tiny pure helper in `mobile/src/live/PartnerIdentityDock.tsx`**
   (no UI/layout rewrite — same render tree, same props): pulled the inline
   name-placeholder logic into two exported functions,
   `isPlaceholderName(raw)` and `resolvePartnerDisplayName(name, nameFallback)`.
   The component now calls `resolvePartnerDisplayName(props.name, props.nameFallback)`
   instead of repeating the empty/`"…"`/`"?"`/`/^partner$/i` checks inline.

3. **New `mobile/src/live/partnerIdentityDisplay.test.mjs`** — mirrors the
   extracted helper (same no-TS-transpile convention as `formatLocLine.test.mjs`
   / `callMetrics.test.mjs`) and asserts:
   - real name always wins over any fallback
   - empty / `undefined` name → short-id fallback preferred over literal "Partner"
   - literal `"Partner"` (any case) treated as placeholder → fallback wins
   - `"…"`, `"..."`, `"?"`, `"？"` treated as placeholders → fallback wins
   - zero-width-char-only "names" treated as empty → fallback wins
   - no fallback available either → last-resort literal `"Partner"`
   - `isPlaceholderName` exposed and correct standalone

## Files
- `mobile/src/live/PartnerIdentityDock.tsx` — extracted `isPlaceholderName` /
  `resolvePartnerDisplayName` pure helpers; component body now calls the
  helper instead of inlining the checks. No JSX/layout change.
- `mobile/src/live/partnerIdentityDisplay.test.mjs` — new test file.
- `mobile/src/identity/formatLocLine.test.mjs` — untouched, already covered
  the loc-line assertions from the task.

## Verify commands run
- `node src/live/partnerIdentityDisplay.test.mjs` — OK
- `node src/identity/formatLocLine.test.mjs` — OK
- `node scripts/test-live-units.mjs` — OK (10/10, auto-discovers
  `src/live/*.test.mjs`, picked up the new file)
- `npm run test:match-ux` — OK (20/20, L0 static invariants incl.
  PartnerIdentityDock mount/blur/stars checks, unaffected by this diff)
- `npx tsc --noEmit -p .` — no errors attributable to `PartnerIdentityDock.tsx`

## Connect risk
none — test-only + a pure-function extraction inside `PartnerIdentityDock.tsx`
with identical runtime behavior (verified via the new tests); no live.tsx,
hub, ICE, or media path touched.
