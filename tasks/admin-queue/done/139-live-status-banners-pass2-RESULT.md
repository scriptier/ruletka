# 139 — LiveStatusBanners second pass

## Status
COMPLETE

## Audit
Re-audited `mobile/src/live/LiveStatusBanners.tsx` after the prior a11y pass (076),
which already fixed: missing `accessibilityRole="alert"` on the `partnerMuted`
banner, decorative emoji leaking into the accessibility tree, and the blur button's
`accessibilityLabel` dropping state text.

Checked for anything left:
- **Props/wiring**: all 9 props (`theyMutedMe`, `partnerMuted`, `remoteBlurred`,
  `showBlurBanner`, `theyMutedLabel`, `partnerMutedLabel`, `blurredLabel`,
  `onUnblur`, `unblurLabel`) are destructured and used; no dead props (unlike 134's
  `LiveQueueHints` finding). Single call site (`mobile/app/live.tsx:4574`) passes
  every label through `t("mobile.live.*") || "<english fallback>"` — no missing
  i18n wiring (unlike 135's `PartnerBlurVeil` finding).
- **i18n overlay coverage**: the 5 keys this component depends on
  (`theyMutedYou`, `youMutedThem`, `blurTitle`, `unblur`, `partnerVideoOn`) are
  only fully present in `en.json`/`ru.json`; most of the other 12 locale overlays
  are missing some or all of them and silently fall back to the English default
  passed in from `live.tsx`. This is the same pre-existing, cross-cutting overlay
  gap flagged as out-of-scope in the 134 (`LiveQueueHints`) pass2 RESULT — it
  affects many components, not just this one, and fixing it here would mean
  editing 12 translation files outside this file's scope. Flagging again for a
  dedicated i18n-overlay task (pattern: `054-i18n-blur-overlay-sync`,
  `133-i18n-report-reasons-overlays`, etc.) rather than touching translation
  files in a single-component pass.
- **Real, in-scope defect found**: the top-of-file docblock said "Mute banners
  still show when Modal is closed," which reads as if the two mute banners are
  gated by the full-screen privacy Modal's state. They aren't — only the blur
  row is conditioned on `showBlurBanner` (wired to `!showPrivacyBlur` at the
  call site); `theyMutedMe`/`partnerMuted` render independently of any Modal
  state. The comment as written could mislead a future edit into adding an
  incorrect Modal-gating condition to the mute banners, which would silently
  hide mute status while the privacy Modal is open — a real regression risk
  given mute-state visibility is part of the connectivity-adjacent UX this repo
  prioritizes.

## Fix
- `mobile/src/live/LiveStatusBanners.tsx`: reworded the docblock comment to
  state plainly that `showBlurBanner` only suppresses the blur row and that
  mute banners are independent of Modal state. No logic, prop, or JSX changes.

## Files touched
- `mobile/src/live/LiveStatusBanners.tsx` (comment only)

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — zero errors attributable to
  `LiveStatusBanners.tsx`; same pre-existing unrelated baseline errors in other
  files (missing native module types, `MediaSession.ts` `Promise` target-lib
  issues) as seen in prior passes on this repo.
- Manual re-read of `mobile/app/live.tsx:4573-4599` (the only call site) to
  confirm prop wiring and the `showBlurBanner={!showPrivacyBlur}` gating claim.
- `grep -n "mobile.live.\(theyMutedYou\|youMutedThem\|blurTitle\|unblur\|partnerVideoOn\)"`
  across all 14 `mobile/src/i18n/overlay/*.json` to confirm the overlay-coverage
  gap described above (only `en`/`ru` fully covered).

## Connect risk
none — comment-only change, no touch to `MediaSession`, offer/ICE, or
`CONNECTIVITY_LOCK` paths.

COMPLETE
