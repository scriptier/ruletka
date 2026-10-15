# BLUR-F6 APK rebuild + Hold smoke

## Goal
Build/install APK with SoftBlur native + F3–F5 wiring; device-smoke privacy Off/Intro/Hold. Soft live blur visible under chrome when Hold/Intro (not invent PASS without logcat/screenshot evidence).

## OWN
- Phone exclusive **one adb** this tick (do not race T8b)
- APK build path used by repo (e.g. mobile scripts / gradle) — human-proceed via this F6 card
- RESULT: `tasks/grok-loop/done/BLUR-F6-apk-smoke-RESULT.md`
- Read-only: SoftBlur Java, SoftBlurRemote, LiveStageVideo, live.tsx Modal

## Gate
1. If `SoftBlurVideoViewManager` / F2 RESULT incomplete: **BLOCKED** — document missing native; **do not invent soft-blur PASS**; optional install tip APK only if already building for other reasons is N/A — prefer wait, write BLOCKED RESULT, COMPLETE as blocked.
2. If F2 native present: build APK → install → logcat `[blur]` + soft path; prefs Intro then Hold if settings reachable.
3. Screenshots under artifacts if possible.

## Done criteria
- [ ] RESULT with device evidence **or** honest BLOCKED (F2 missing / no device)
- [ ] Explicit non-claims: no invent multi PASS; Hold PASS only if logcat `mode=hold` + veil/soft stayed until Show video
- [ ] COMPLETE

## Must not
- Force-push
- Claim product PASS without adb evidence
- Edit F2 Java / F4 LiveStageVideo / F5 Modal while smoking (read-only)
- Dual adb with other phone jobs

## Factory
Director tick 2026-08-12 · plan §F F6 · APK when F6 card
