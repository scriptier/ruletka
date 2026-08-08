# Task: DEVICE_SMOKE + Play checklist version refresh

## Goal
Bring device smoke and Play internal checklist docs in line with **0.1.148 / vc156** and current polish (friends CTAs, Live soft toasts, gifts mid-chat, Stop one-tap).

## Context
- Docs still mention older versions in places (e.g. 0.1.136).
- Human will smoke in the morning; checklist must not lie.

## Scope (only these)
- `docs/DEVICE_SMOKE.md`
- `docs/PLAY_INTERNAL_TEST_CHECKLIST.md`
- Optionally `docs/POLISH_NOW.md` remaining table only if stale

## Done criteria
- [ ] Current version table = 0.1.148 / vc156 (or app.json if bumped)
- [ ] Smoke steps cover: connect A/V, gifts mid-chat, Stop one-tap, friends Online/Call/Chat, report, soft toasts
- [ ] No deploy / push
- [ ] RESULT with **COMPLETE**

## Completion promise
When done criteria are met, put `COMPLETE` in RESULT under **Completion promise**.

## Do not
- Touch WebRTC / offer path
- Build APK / Play upload
