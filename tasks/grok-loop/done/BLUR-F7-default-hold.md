# BLUR-F7 default hold product

## Goal
Product policy: default blur mode **hold** (Until I tap) in mobile store/prefs; optional one-shot intro→hold migration only if already documented pattern exists. No device smoke.

## OWN
- `mobile/src` store/prefs blur default only (find `blurMode` / settings store — e.g. store.ts / prefs)
- Optional: settings copy if one string needed for default label
- RESULT: `tasks/grok-loop/done/BLUR-F7-default-hold-RESULT.md`
- **Not** SoftBlur Java, LiveStageVideo, live.tsx Modal chrome, APK

## Work
1. Locate current default blur mode (`intro` vs `hold` vs `off`)
2. Set default to hold if product policy; document prior default in RESULT
3. Unit if cheap (`blurMode` tests) — do not thrash
4. No invent Hold product PASS on device

## Done criteria
- [ ] Default hold on disk or honest N/A if already hold
- [ ] RESULT + COMPLETE + explicit non-claim device Hold PASS
- [ ] No APK

## Must not
- F2 native, F6 adb, deploy, force-push, MediaSession, multi invent PASS

## Factory
Director tick 2026-08-12 · plan §F F7
