# BLUR-F19s multi SoftBlur static reconfirm (read-only)

## Goal
Post-F18 residual: reconfirm on disk that multi SoftBlur **wiring + product flag** still intact. **Static only — not device multi SoftBlur PASS.**

## OWN
- Read-only: `mobile/src/live/SoftBlurRemote.tsx`, `LiveStageVideo` / stage multi tile soft path, `mobile/src/live/index.ts` re-export
- Optional: `node mobile/scripts/verify-match-ux.mjs` (read-only)
- RESULT: `tasks/grok-loop/done/BLUR-F19s-multi-soft-static-reconfirm-RESULT.md`

## Work
1. Confirm `SOFT_BLUR_PRODUCT_ENABLED = true` (cite line)
2. Confirm multi-tile soft path still: per-tile stream URL + SoftBlurRemote/PartnerBlurVeil branch; hunt ≠ multi soft
3. Note F17/F18 device multi still OPEN / NOT claimed
4. Explicit: **no invent multi SoftBlur PASS**

## Must not
Product edits, adb, force-push, invent multi device PASS, APK
