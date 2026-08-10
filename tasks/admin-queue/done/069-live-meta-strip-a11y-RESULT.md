# 069 — LiveMetaStrip accessibility

## Status
COMPLETE (audit only — no code changes needed)

## Findings
`mobile/src/live/LiveMetaStrip.tsx` has exactly one interactive element: the
`Pressable` wrapping `metaLine`. It already receives a fully-populated,
localized `accessibilityLabel` prop (and `accessibilityRole="button"`) from
its caller in `mobile/app/live.tsx:4527-4563`:

- Connected: `t("mobile.live.meta", { stars, online, wait })`
- Disconnected: `t("mobile.home.hubOfflineTap")`

Both i18n keys exist in `mobile/src/i18n/overlay/en.json` (and other locale
overlays). `waitLine` and `searchTimerLine` are plain `Text` nodes, not
pressable, so no label is required for them.

No pressable chip is missing an `accessibilityLabel`. No edits made.

## Files touched
None (audit-only; no changes to `LiveMetaStrip.tsx` or i18n files were
necessary).

## Verify commands run
- `npx tsc --noEmit -p .` (from `mobile/`) — pre-existing unrelated errors
  only (missing `node_modules` packages like `expo-clipboard`,
  `react-native-gesture-handler`, etc., and pre-existing issues elsewhere in
  `app/live.tsx`). Nothing reported against `LiveMetaStrip.tsx`.

## Connect risk
none

COMPLETE
