# RESULT: Mobile trio.slotEmpty overlay (hunt raw key)

## Status
COMPLETE — verified only, no code changes needed.

## Findings
- `mobile/src/i18n/overlay/*.json` (all 14 supported langs: en, ru, uk, pl, cs,
  bg, sr, de, es, fr, pt, tr, ar, zh) already define both
  `trio.slotEmpty` and `trio.searching` as flat keys.
- `mobile/src/i18n/mobile-overlay.ts` requires every one of those overlay
  files into `MOBILE_BY_LANG`, with `MOBILE_EN = overlay/en.json` as the
  fallback pack.
- `translate()` in `mobile/src/i18n/index.tsx` resolves
  `overlay[key] ?? enOverlay[key] ?? key` — since `en` has both keys, a raw
  `trio.slotEmpty` / `trio.searching` key can never reach the UI for any
  supported language.
- `mobile/app/live.tsx` call sites (line 3538, lines 5741-5742) also carry
  their own literal-string fallbacks (`|| "Looking for a 3rd…"` etc.) as a
  second safety net on top of the i18n fallback chain.
- `mobile/src/i18n/packs/*.json` (synced copies of `ui/i18n/*.json`) are
  **not** imported by any runtime code — only `overlay/*.json` feeds `t()`.
  Confirmed via grep; only referenced by `preflight.sh`/`sync-i18n.sh`/README.
- Validated all 14 `overlay/*.json` files parse as valid JSON.

## Files touched
None — repo already in the desired state on this branch/worktree.

## Verify commands run
- `node -e "JSON.parse(...)"` over all `mobile/src/i18n/overlay/*.json` — all OK.
- `grep -rn 'trio\.(slotEmpty|searching)'` across `mobile/` — present in every
  overlay lang file and both `live.tsx` call sites.

## Connect risk
none — no code changed, read-only verification of i18n overlay wiring.
