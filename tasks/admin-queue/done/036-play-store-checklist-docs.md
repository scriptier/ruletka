# Task: P2 — Play internal-test readiness checklist (docs only)

**Priority:** NICE — **best zero-risk filler** only after **001b** is COMPLETE (or explicitly smoke-handoff). Morning human handoff.

## Goal
One short checklist for human: app version (**0.1.126 / vc134** lock baseline or later), data safety form alignment, screenshot assets path, what to smoke before Play **internal** track. **No store upload.**

## Scope (only these)
- `docs/PLAY_OPS.md` and/or `docs/PLAY_UPLOAD.md` — overnight / morning handoff section
- Link `docs/DEVICE_SMOKE.md` (Play↔PC P0 smoke) + `docs/CONNECTIVITY_LOCK.md`
- Link `docs/PLAY_DATA_SAFETY.md` if present
- `mobile/assets/store/LISTING.md` version note only if stale

## Done criteria
- [ ] Checkbox checklist for human (install APK → smoke → listing → data safety → internal track)
- [ ] Explicit **out of scope:** Play Console upload, bulk APK on website, deploy
- [ ] Mentions current ship tip smoke target: Play↔PC on CONNECTIVITY_LOCK (1 offer + 1 answer, `force_relay=false` on LAN)
- [ ] APK version note matches lock: **0.1.126 / versionCode 134** (or “later that still respects lock”)
- [ ] No deploy / no APK site upload / no push
- [ ] RESULT contains **`COMPLETE`**

## Completion promise
Put **`COMPLETE`** in RESULT when checklist exists and links smoke docs.

## Do not
- Play Console upload
- Bulk APK on website
- Product code changes
