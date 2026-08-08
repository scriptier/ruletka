# Google Play app — polish plan

**Baseline APK:** `0.1.148+` · Connect lock: `CONNECTIVITY_LOCK.md`  
**Do not** regress P2P / one-offer / gifts mid-chat unlock.

## Shipped recently

| Area | Notes |
|------|--------|
| Connect speed + 001b | Offer re-kick, no stale lock 24s stall |
| Gifts | Mid-chat effects unlocked (not 5–15 min review bar) |
| Live UI | Gift strip, chat bubbles, connecting card, Report FAB |
| Stop | One-tap, no confirm (phone + web) |
| Geo / hotkeys | City RU map + taller keys help |
| Friends row | Online pill + labeled Call / Chat CTAs |
| Settings alerts | User-facing notify copy (no webhook jargon) |
| Live soft toasts | partnerNotReady / need stars / add friend / party errors |
| Open-on-PC QR | Design only — `docs/OPEN_ON_PC_QR.md` (`090`) |

## Plan (priority order)

### P0 — Feel premium on Live

1. **Fewer ugly system popups** — **done** Friends + Live soft errors → toast; Stop one-tap; keep Alert for block/remove/clear + add-friend prompt.
2. **Idle chrome** — **done** idle hint “N online · tap Start”.
3. **Friends screen density** — **done** Online pill + labeled Call/Chat.

### P1 — Store + retention

4. **AAB for latest version** — rebuild with `build-aab-local.sh` after version bump.
5. **Play Console** (human) — listing, screenshots, data safety, upload AAB.
6. **Push rings** — Expo path on hub; Settings copy + Register button; killed-app smoke on device.

### P2 — Optional / deferred

7. Prefer Direct Android (deferred).
8. Open-on-PC QR — **design done**; implement phase 1 UI later (`OPEN_ON_PC_QR.md`).
9. Lottie gifts / SFU (parked).

## Execution notes

- After meaningful `mobile/` changes → `./scripts/build-apk-local.sh --bump`.
- Web deploy only when web UI/docs need it; no bulk APKs on site.
