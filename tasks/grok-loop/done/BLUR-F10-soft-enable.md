# BLUR-F10 re-enable SoftBlur product switch

## Goal
`SOFT_BLUR_PRODUCT_ENABLED` is **false** on disk (`SoftBlurRemote.tsx`), so `isSoftBlurNativeAvailable()` always returns false → always PartnerBlurVeil despite F2–F5 ship + F6/F8 device softNative evidence on **0.1.368**. Re-enable product soft path (set **true**) with honest comment citing F6 Hold + F8 Intro evidence. No invent multi SoftBlur PASS.

## OWN
- `mobile/src/live/SoftBlurRemote.tsx` (flag + comments only; prefer minimal)
- Optional: verify-match-ux / blur unit if they assert flag
- RESULT: `tasks/grok-loop/done/BLUR-F10-soft-enable-RESULT.md`
- **Not** LiveStageVideo rewrite, **not** F2 Java, **not** adb (F11 smokes)

## Work
1. Confirm F9 RESULT: gate forces veil
2. Set `SOFT_BLUR_PRODUCT_ENABLED = true`
3. Update header comments (product ON; native + RN path; veil still fallback when native missing)
4. Run `node mobile/scripts/verify-match-ux.mjs` if needed
5. RESULT COMPLETE — no invent multi device PASS; APK re-smoke = F11

## Must not
Force-push, invent multi PASS, MediaSession thrash, dual APK with F11 race-edit same files

## Factory
Director tick · F residual kill-switch after F9 audit
