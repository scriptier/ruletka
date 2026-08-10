# 135-partner-blur-veil-compact — PartnerBlurVeil compact badge a11y

## Status
COMPLETE

## Audit
`PartnerBlurVeil` (mobile/src/live/PartnerBlurVeil.tsx) is presentational — it
never calls `t()` itself. Its compact ("pip") badge text and its
accessibility label both fall back to hardcoded English strings
(`"blur"` for the badge text, `"Show video"` for the a11y label) whenever no
`buttonLabel` prop is supplied:

```
{title || buttonLabel || "blur"}                                   // badge text
[title, partnerLabel, buttonLabel || "Show video"].join(". ")       // a11y label
```

The two `compact` call sites in `LiveStageVideo.tsx` (main split-tile veil at
line ~248, PiP veil at line ~513) never passed `buttonLabel`, so both the
visible badge and the screen-reader label were always the untranslated
English fallback for every non-English user — a real a11y gap, not just
cosmetic.

## Fix
Wired the existing `mobile.live.unblurShort` i18n key ("Show video" / "Показать")
through as `buttonLabel` for both compact veils, via a new `labels.unblurShort`
field (same pattern as the other `labels.*` strings already threaded through
this component):

- `mobile/src/live/LiveStageVideo.tsx`
  - `LiveStageVideoProps.labels`: added `unblurShort?: string`
  - Split-tile compact `PartnerBlurVeil` (remote tile veil): added
    `buttonLabel={L.unblurShort}`
  - PiP compact `PartnerBlurVeil`: added `buttonLabel={L.unblurShort}`
- `mobile/app/live.tsx`
  - `labels={{ ... }}` passed to `<LiveStageVideo>`: added
    `unblurShort: t("mobile.live.unblurShort") || "Show video"`

No changes to `PartnerBlurVeil.tsx` itself — it already had the right
priority/fallback logic, it just wasn't being fed a translated label at these
two call sites.

## Follow-up (not done, out of scope for a minimal fix)
`mobile.live.unblurShort` currently only has translations in `en.json` and
`ru.json`; the other 12 locale overlays fall back to the English default
(same as before this fix, so no regression). Worth a translation pass later.

## Files touched
- mobile/src/live/LiveStageVideo.tsx
- mobile/app/live.tsx

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — no new errors introduced by
  these edits (pre-existing unrelated errors in `live.tsx` — missing
  `expo-keep-awake`/`react-native-view-shot`/`expo-clipboard` type decls, a
  `push` TDZ issue, dynamic-import module-flag warnings — are all
  pre-existing in the worktree, untouched by this task)
- `grep -n "unblurShort" mobile/src/live/LiveStageVideo.tsx` — confirms both
  compact call sites now pass the localized label

## Connect risk
none — presentational/i18n-only change, no touch to MediaSession, offer/ICE,
or CONNECTIVITY_LOCK paths.

COMPLETE
