# MOBILE-clean-chrome — RESULT

**Status:** COMPLETE  
**OWN:** static read of `mobile/app/live.tsx`, `LiveGiftBar.tsx`, `LiveBottomBar.tsx`  
**Date:** 2026-08-12  
**Code change:** none (RESULT only; no tiny fix needed)  
**Must not:** MediaSession thrash, APK, deploy — **obeyed**

## Goal

Confirm Android star countdown off (no stage `starProg`, LiveGiftBar `showUnlockBar` false), bottom bar friends left + settings right + no cam-off.

## Verdict

| Check | Result |
|-------|--------|
| Stage `starProg` countdown row removed | **PASS** — style keys orphaned; no JSX usage |
| LiveGiftBar unlock bar off by default | **PASS** — `showUnlockBar = false` |
| Call sites do not enable unlock bar | **PASS** — both `LiveGiftBar` mounts omit prop |
| Bottom bar Friends leftmost secondary icon | **PASS** — `live-friends-btn` first in left cluster |
| Bottom bar Settings far right | **PASS** — `live-settings-btn` + `onOpenSettings` wired |
| No cam-off toggle on bar | **PASS** — intentionally omitted; no `live-cam-btn` |

**Overall: CONFIRMED / PASS (static only).** No code change. No device smoke. No invent runtime PASS.

---

## 1. Star countdown off

### LiveGiftBar (`mobile/src/live/LiveGiftBar.tsx`)

- Prop docs L32–35: show post-chat ★ unlock countdown default **false** (easter egg / clean UI).
- Default: `showUnlockBar = false` (L53).
- Unlock UI gated: `{showUnlockBar && !starReady ? …}` and `{showUnlockBar && starReady && !compact ? …}` (L106–144).
- Gifts chips remain available regardless of unlock bar.

### live.tsx call sites

| Layout | Approx | `showUnlockBar` passed? |
|--------|--------|-------------------------|
| Native matched gifts | ~L6628–6661 | **no** → default false |
| Browser dock gifts | ~L6709–6743 | **no** → default false |

`starProgress` / `starReady` still computed (L5593–5594) and passed for potential easter-egg enable; **progress UI not rendered** while `showUnlockBar` is false.

### Stage `starProg` row

| Item | Evidence |
|------|----------|
| `liveStyles.starProg` / Track / Fill / Label | Defined only in `mobile/src/live/liveStyles.ts` L1022–1040 |
| JSX / `styles.starProg` consumers | **zero** across repo (`styles.starProg` grep empty) |
| Stage countdown row in `live.tsx` | **absent** |

Dead style keys are leftover; not user-visible. Optional future cleanup only — not required for this ticket.

---

## 2. Bottom bar layout (`mobile/src/live/LiveBottomBar.tsx`)

Header contract (L8–10):

```text
Secondary icons (left → right):
  Friends · Mic · Flip · partner mute · blur · more · … Settings (far right)
Cam off/on is intentionally omitted (use Settings if needed later).
```

### Secondary row structure

| Side | Content | testID / notes |
|------|---------|----------------|
| **Left cluster** (first) | Friends (`people`) | `live-friends-btn` L292 |
| Left (rest) | Mic · Flip · partner mute · blur · more | phase-gated |
| **Far right** | Settings (`settings-outline`) | `live-settings-btn` L434, only if `onOpenSettings` |

Layout: outer row `justifyContent: "space-between"` (L275–281); Friends in left `flexDirection: "row"` (L285–305); Settings after cluster (L427–448).

### live.tsx wiring

- `onOpenFriends` → `router.push("/friends")` (~L6841–6844)
- `onOpenSettings` → `router.push("/settings")` (~L6845–6849)
- Labels include `friends` / `settings` (~L6814–6817)

### No cam-off on bar

| Evidence | Detail |
|----------|--------|
| Comment L90–91 | `onToggleCam?` kept for callers; **cam toggle removed from bar UI** |
| L112–113 | `camOn` aliased `_camOn` — unused in render |
| Render | No cam `Pressable`, no `videocam` / `videocam-off` icon |
| testIDs | start/stop/report/next/friends/mic/flip/partner-mute/blur/settings — **no `live-cam-btn`** |
| live.tsx | Does **not** pass `onToggleCam` |

Cam-off still exists as media capability + toast elsewhere (`toggleCam` / `camOffToast` in live.tsx); it is **not** a bottom-bar chrome control.

---

## 3. Out of scope / notes

- PC clean chrome (LIVE/water/volume hide, star-unlock easter egg) — separate card `02-CLEAN-chrome-verify`.
- Device/UI smoke of mid-match bar — not run (static ticket).
- Orphan `starProg*` styles — optional dead-code sweep later.
- No MediaSession / APK / deploy.

## COMPLETE
