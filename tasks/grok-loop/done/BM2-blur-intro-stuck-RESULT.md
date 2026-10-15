# BM2 blur intro stuck — RESULT (audit only)

**Status:** COMPLETE · **AUDIT ONLY — no `live.tsx` edit**  
**Date:** 2026-08-11  
**OWN this hop:** timer-path audit only  
**Sibling OWN conflict:** `BM2-blur-match-apply-fix` (running) owns `mobile/app/live.tsx` blur/match paths → **no dual-edit**. Fix deferred to sibling or follow-up after match-apply lands.  
**MediaSession:** untouched · **Multi:** no invent PASS · **APK/deploy:** none

## Goal (plan A3)

`scheduleIntroUnblur`: if no frames within **~8s**, **peel** or **toast “waiting for video”** — do not loop forever.  
Source: `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` A3.

## Ownership decision

| Actor | Action |
|-------|--------|
| This hop (BM2-blur-intro-stuck) | **RESULT audit** of timer path only |
| Sibling BM2-blur-match-apply-fix | **Owns** `live.tsx` blur/match apply — may touch same region |
| Dual write | **Forbidden** (grok-loop one-writer rule) |

If match-apply does not absorb A3, enqueue a follow-up with exclusive OWN after sibling COMPLETE.

---

## Timer path map (`mobile/app/live.tsx`)

| Symbol | ~Line | Role |
|--------|-------|------|
| `introUnblurTimerRef` | 369–371 | single setTimeout handle |
| `INTRO_UNBLUR_MS` | 373 | **2800** first delay after schedule |
| `clearIntroUnblurTimer` | 379–384 | cancel pending tick |
| `revealPartnerVideo(why)` | 391–417 | peel veil; clears timer; soft `forceRepaintRemote` |
| **`scheduleIntroUnblur`** | **419–447** | **A3 target** |
| `applyMatchBlurVeil` | 453–477 | intro → re-arms schedule; hold → clear |
| `onRemoteStream` re-arm | 1049–1071 | vt>0 + veiled + intro → schedule; audio-only + intro → schedule after 1800 |
| Match handler schedule | 2866–2868 | wantBlur + intro → schedule (before `remoteVideoSeen` reset) |
| Match reset | 2876 | `remoteVideoSeenRef = false` immediately after schedule |

### Call graph

```text
matched (!keepPrimary, stranger, effective intro)
  → setRemoteBlurred(true)
  → scheduleIntroUnblur()          // first arm, often before any frames
  → remoteVideoSeenRef = false     // clears any prior-match flag

onRemoteStream (vt>0, still veiled, intro)
  → scheduleIntroUnblur()          // re-arm after paint signal

onRemoteStream (vt=0, at>0, intro, still veiled)
  → setTimeout 1800 → scheduleIntroUnblur()

applyMatchBlurVeil("prefs_load"|"settings_focus"|…)
  → if intro: scheduleIntroUnblur()
```

---

## Current behavior (proven by read)

```ts
// ~419–447
const scheduleIntroUnblur = useCallback(() => {
  if (blurModeRef.current !== "intro") return;
  if (!remoteBlurredRef.current) return;
  clearIntroUnblurTimer();
  const tick = (delay: number) => {
    introUnblurTimerRef.current = setTimeout(() => {
      introUnblurTimerRef.current = null;
      if (phaseRef.current !== "matched") return;
      if (!remoteBlurredRef.current) return;
      if (blurModeRef.current !== "intro") return;
      const frames =
        !!remoteVideoSeenRef.current ||
        !!mediaRef.current?.hasInboundVideoFrames?.();
      if (!frames) {
        blurLog("blur intro wait frames");
        tick(1200);           // ← UNBOUNDED re-poll
        return;
      }
      revealPartnerVideo("intro_auto");
      showToastRef.current(tRef.current("mobile.live.partnerVideoOn"));
    }, delay);
  };
  tick(INTRO_UNBLUR_MS);      // 2800 first hop
}, […]);
```

| Property | Value | A3 need |
|----------|-------|---------|
| First delay | 2800 ms | OK (soft intro cover after paint) |
| Frame gate | `remoteVideoSeenRef` OR `hasInboundVideoFrames()` | Intentional — avoid peel-to-black |
| No-frame path | `tick(1200)` forever | **FAIL A3** — unbounded |
| Max wait | **none** | need **~8000 ms** |
| Max-wait action | **none** | peel **or** toast “waiting for video” |
| Happy path toast | `mobile.live.partnerVideoOn` (“Partner video shown”) | OK |
| “Waiting for video” key | **no dedicated i18n key** | toast may use fallback EN or existing conn copy |

---

## Stuck scenarios (code-level)

| # | Sequence | Result today |
|---|----------|--------------|
| S1 | Intro veil on match; partner black / no inbound frames forever | Logs `blur intro wait frames` every ~1.2s **indefinitely**; veil never peels; user may think cam dead |
| S2 | Audio-only first (`vt=0, at>0`); schedule after 1.8s; still no video | Same infinite poll |
| S3 | Frames arrive after long delay | Eventually peels at next tick after frames — OK product, but can exceed 8s with no intermediate toast |
| S4 | Mode → hold / off / toggle peel mid-wait | Guards exit; timer cleared on reveal — OK |
| S5 | Phase leaves matched | Tick no-ops — OK |

**BM1 phone forensics context (not re-run):** mid-match veil often **not** mounting (`[blur] show` = 0). A3 only matters **after** veil is applied; match-apply sibling is the gate for “show”. When veil **does** mount and video is slow/black, **this** infinite wait is the residual.

---

## Gap vs plan A3

| Plan A3 | Disk today | Verdict |
|---------|------------|---------|
| Max wait ~8s | unbounded `tick(1200)` | **GAP** |
| Then peel **or** toast “waiting for video” | neither on max wait | **GAP** |
| Don’t loop forever | loops forever while matched+intro+veiled | **GAP** |

**Code edit this hop:** none (sibling OWN).

---

## Recommended minimal fix (for sibling or follow-up OWN)

Implement **only** inside `scheduleIntroUnblur` (no MediaSession / multi):

1. Capture `const t0 = Date.now()` when schedule starts (after clear).
2. Constants: e.g. `INTRO_UNBLUR_MS = 2800`, `INTRO_FRAME_POLL_MS = 1200`, `INTRO_UNBLUR_MAX_WAIT_MS = 8000`.
3. On `!frames`:
   - if `Date.now() - t0 >= INTRO_UNBLUR_MAX_WAIT_MS`:
     - **Preferred peel path (matches “don’t stay black forever” comment ~1037):**  
       `revealPartnerVideo("intro_max_wait")` + optional toast fallback `"Waiting for video"` (or existing linking copy).  
     - **Alt toast-only:** keep veil, one-shot toast, **stop** re-arming (still ends the infinite loop).  
     - Plan allows either; peel is stronger UX for black stage under frosted veil.
   - else: `blurLog("blur intro wait frames"); tick(INTRO_FRAME_POLL_MS)`.
4. Log: `console.log("[blur] intro max wait peel|toast")` for forensics.
5. Do **not** invent multi PASS; unit optional later.

### Suggested sketch (not applied)

```ts
const INTRO_UNBLUR_MS = 2800;
const INTRO_FRAME_POLL_MS = 1200;
const INTRO_UNBLUR_MAX_WAIT_MS = 8000;

const scheduleIntroUnblur = useCallback(() => {
  if (blurModeRef.current !== "intro") return;
  if (!remoteBlurredRef.current) return;
  clearIntroUnblurTimer();
  const t0 = Date.now();
  const tick = (delay: number) => {
    introUnblurTimerRef.current = setTimeout(() => {
      introUnblurTimerRef.current = null;
      if (phaseRef.current !== "matched") return;
      if (!remoteBlurredRef.current) return;
      if (blurModeRef.current !== "intro") return;
      const frames =
        !!remoteVideoSeenRef.current ||
        !!mediaRef.current?.hasInboundVideoFrames?.();
      if (!frames) {
        if (Date.now() - t0 >= INTRO_UNBLUR_MAX_WAIT_MS) {
          blurLog("blur intro max wait");
          console.log("[blur] intro max wait peel why=intro_max_wait");
          revealPartnerVideo("intro_max_wait");
          try {
            showToastRef.current(
              tRef.current("mobile.live.linkingCameras") ||
                "Waiting for video"
            );
          } catch { /* ignore */ }
          return;
        }
        blurLog("blur intro wait frames");
        tick(INTRO_FRAME_POLL_MS);
        return;
      }
      revealPartnerVideo("intro_auto");
      try {
        showToastRef.current(tRef.current("mobile.live.partnerVideoOn"));
      } catch { /* ignore */ }
    }, delay);
  };
  tick(INTRO_UNBLUR_MS);
}, [clearIntroUnblurTimer, revealPartnerVideo, blurLog]);
```

Note: re-arm from `onRemoteStream` / `applyMatchBlurVeil` resets `t0` (fresh 8s) — correct after a new schedule intent.

### i18n note

- Happy peel already uses `mobile.live.partnerVideoOn`.
- No exact “Waiting for video” key; nearby: `mobile.live.linkingCameras` (“Linking cameras…”), `connConnecting` / `connStill`. Fallback EN string acceptable for minimal fix; full i18n can be Claude lane later.

### Out of scope for A3

- Web `ui/live.js` intro blur is rep/score based (`INTRO_BLUR_MS = 3000`), not frame-gated — different product path.
- Match veil **not mounting** (BM1 forensics) → match-apply sibling.
- Veil z-order → BM2-veil-zorder.

---

## Fix this hop

**None** — dual-OWN with `BM2-blur-match-apply-fix` on `live.tsx`. Audit + recommended patch only.

## Not done (by design)

- No `live.tsx` write
- No device smoke of max-wait peel
- No i18n key mint
- No multi invent PASS / APK

## Job complete

RESULT → `tasks/grok-loop/done/BM2-blur-intro-stuck-RESULT.md`  
Running card → done.
