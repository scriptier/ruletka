# 134 — LiveQueueHints second pass

## Status
COMPLETE

## Audit findings
Re-audited `mobile/src/live/LiveQueueHints.tsx` after the prior i18n/a11y pass (075). All visible
strings still flow through the `labels` prop sourced from existing `t()` keys in
`mobile/app/live.tsx:4194-4204`; no hardcoded/untranslated strings, no new keys needed.

Checked the app's 14 supported languages (`mobile/src/i18n/overlay/*.json`) for the keys this
component renders (`mobile.live.longSearchTitle/Body/invite/copyLink`, `btn.stop`,
`friends.aloneInviteTitle/Body`, `mobile.friends.yourCode/shareInvite`). Several keys only have
real per-language values in a couple of locales and fall back to English elsewhere — but that's a
pre-existing, cross-cutting gap in the overlay translation data affecting many components, not
something specific to `LiveQueueHints.tsx`. Out of scope for a single-file pass; flagging here for
a dedicated i18n-overlay task instead of touching translation files.

Found one real, in-scope defect: `searchSecs: number` was declared in `LiveQueueHintsProps` and
passed in from `live.tsx`, but never read inside the component (not destructured, not used in the
JSX) — dead prop left over from before the long-search label's `{s}` formatting was moved to the
`t()` call site.

## Fix
- Removed unused `searchSecs` prop from `LiveQueueHintsProps` in `LiveQueueHints.tsx`.
- Removed the corresponding `searchSecs={searchSecs}` pass-through at the `<LiveQueueHints>` call
  site in `live.tsx` (the `searchSecs` local var itself is still used elsewhere in `live.tsx`, e.g.
  the `longTitle` label and the separate search-elapsed label — untouched).
- No behavior/layout/style/string changes.

## Files touched
- `mobile/src/live/LiveQueueHints.tsx`
- `mobile/app/live.tsx` (one line, removing the now-unused prop pass-through)

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — same pre-existing baseline errors as before (missing
  native modules, unrelated files); zero errors in `LiveQueueHints.tsx` or from the edited
  `live.tsx` line.
- `grep -rn searchSecs mobile` — confirmed no other reference to `LiveQueueHints`'s removed prop;
  `searchSecs` remains correctly used by `useSearchPulse`, `LiveSearchLabel`, and the two `t()`
  calls in `live.tsx` that still need it.

## Connect risk
none — no changes to connect path, MediaSession, or ICE/offer logic. Pure dead-prop removal in an
already-conditionally-rendered UI component.

COMPLETE
