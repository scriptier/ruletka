# BM2b blur intro max wait (A3) — RESULT

**Status:** COMPLETE  
**Date:** 2026-08-11  
**OWN:** `mobile/app/live.tsx` — `scheduleIntroUnblur` / intro timer only  
**MediaSession:** untouched · **Multi:** no invent PASS · **APK/deploy:** none

## Goal (plan A3)

`scheduleIntroUnblur` must not loop forever on missing frames. After ~8s total without peel: `revealPartnerVideo("intro_timeout")` + waiting toast. Cap re-arm count (3 × 1.2s after first 2.8s).

Source: `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` A3 · prior audit `BM2-blur-intro-stuck-RESULT.md` · match-apply already COMPLETE.

## Root cause (pre-fix)

```ts
if (!frames) {
  blurLog("blur intro wait frames");
  tick(1200);  // unbounded while matched + intro + veiled
  return;
}
```

| Property | Before | A3 need |
|----------|--------|---------|
| First delay | 2800 ms | OK |
| Frame gate | `remoteVideoSeenRef` OR `hasInboundVideoFrames()` | OK |
| No-frame path | `tick(1200)` forever | **FAIL** |
| Max wait / re-arm cap | none | ~8s + re-arm max |

## Fix applied

**File:** `/home/drakosik/freenet-roulette/mobile/app/live.tsx` only — `scheduleIntroUnblur` + constants next to it.

| Constant | Value | Role |
|----------|-------|------|
| `INTRO_UNBLUR_MS` | 2800 | First delay (unchanged) |
| `INTRO_FRAME_POLL_MS` | 1200 | Re-poll interval |
| `INTRO_FRAME_REARM_MAX` | 3 | Max re-arms after first tick |
| `INTRO_UNBLUR_MAX_WAIT_MS` | 8000 | Wall-clock cap from schedule `t0` |

### Behavior

1. On schedule: clear prior timer, `t0 = Date.now()`, `rearmCount = 0`, first `tick(2800)`.
2. On tick with frames → `revealPartnerVideo("intro_auto")` + `partnerVideoOn` toast (unchanged happy path).
3. On tick without frames:
   - if `rearmCount >= 3` **or** `waited >= 8000ms`:
     - log `[blur] intro max wait peel why=intro_timeout …`
     - `revealPartnerVideo("intro_timeout")`
     - toast `mobile.live.linkingCameras` || `"Waiting for video"`
     - **stop** (no further re-arm)
   - else: `rearmCount++`, log wait, `tick(1200)`.

### Timeline (no frames ever)

| Event | ~t |
|-------|-----|
| schedule | 0 |
| first check | 2.8s → rearm 1 |
| poll | 4.0s → rearm 2 |
| poll | 5.2s → rearm 3 |
| poll | 6.4s → **rearm cap → peel intro_timeout** |

Wall clock 8s is a safety net if timers drift or a future call path changes delays. Re-arm from `onRemoteStream` / `applyMatchBlurVeil` resets `t0` (fresh schedule intent) — intentional.

## Out of scope

- No MediaSession / multi / web `live.js` (rep-based intro, different path)
- No APK rebuild / device smoke this hop
- No new i18n key (uses existing `linkingCameras`)
- No invent multi PASS

## Verify next (human / device after Metro or APK)

1. Settings → Blur strangers = **Intro**
2. Match with black / no inbound frames (or throttle remote video)
3. Expect logcat within ~7s:  
   `[blur] intro max wait peel why=intro_timeout rearm=3 …`  
   then `[blur] hide why=intro_timeout`
4. Toast: linking / waiting copy (not infinite `blur intro wait frames`)
5. Happy path with frames: still peels `intro_auto` after ~2.8s + paint

## Job complete

RESULT → `tasks/grok-loop/done/BM2b-blur-intro-max-wait-RESULT.md`  
Running card → done.
