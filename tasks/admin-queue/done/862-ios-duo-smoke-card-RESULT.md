# RESULT: 862 GF/TestFlight duo smoke card

**Status:** DONE

**Files touched:**
- `mobile/assets/store/ios/SMOKE-DUO.md` (new)

**What changed:**
One-page duo smoke card for a non-technical partner testing TestFlight
0.1.477 (5) against a second person on `https://ruletka.vip` (browser).
Covers: confirm build is (5) not stale (4) (cross-checked against
`docs/IOS_ASC_CHECKLIST.md:41`, which names 0.1.477 (5) as the correct
uploaded TestFlight build); camera/mic grant; one browser tab only; Start
timing; expected layout (portrait = partner top / you bottom, landscape =
partner left / you right); and that a "Recvonly" partner tile means the
partner denied/disabled their camera (confirmed against SDP recvonly
handling in `mobile/src/media/MediaSession.ts`), not a connect bug — so it
isn't misreported.

**Verify commands run:**
- `find`/`grep` to confirm no existing `SMOKE-DUO.md` or overlapping doc
  (none found; closest prior art is `mobile/assets/store/ios/WHAT-TO-TEST.md`
  and `docs/DEVICE_SMOKE.md`, used for tone/format reference only, not
  edited).
- No app code changed, so no `tsc` / unit test run needed (docs-only OWN
  scope per task).

**Connect risk:** none — docs-only file, no touches to `mobile/src/media/*`,
`ui/webrtc.js`, `ui/live.js`, or any ICE/MediaSession/deploy path.

COMPLETE
