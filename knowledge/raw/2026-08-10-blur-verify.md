# blur-verify 2026-08-10

PASS on Android privacy veil path after blur-fix. Eye → `togglePartnerBlur`; `showPrivacyBlur` → Android Modal + `PartnerBlurVeil` + Show video; unblur via veil / back / more / eye (when chrome reachable). Friends never auto-veil. Default prefs **off** (connect-first; intro/hold opt-in). Stage RTCView zOrder 0 while veiled; chrome Modal suppressed under privacy Modal. `blurMode.test.mjs` green. Minor: settings chip fallback + store comments aligned to default off.
