# Second critic: phone-desk + linking measure (no MediaSession)

## Goal
Read-only critic of the phone-lab hop.

Check:
1. `scripts/phone-desk.sh` exists; `guard` exits 2 on keyguard; no APK install
2. `docs/MOBILE_BUILD.md` mentions phone-desk
3. If `artifacts/av-verify/latest.md` is newer than `20260812T193821Z`, quote mto/mta/product — do **not** call linking GOAL_MET unless mto p50&lt;800 and mta&lt;2500 **and** product.ok
4. If latest is still 193821Z, say measure did not beat residual / in flight
5. Device-smoke SKIP_INSTALL only — no new APK in this hop

## OWN
- `tasks/admin-queue/done/481-phone-desk-critic-RESULT.md` only

## Must not
MediaSession, live.js, webrtc.js, deploy, APK, invent product.ok / MULTI_PASS

## Done
RESULT + COMPLETE. Connect risk none|low.
