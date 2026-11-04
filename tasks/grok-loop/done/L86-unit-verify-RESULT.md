# L86 unit verify — RESULT

**Status:** COMPLETE  
**Date:** 2026-08-12  
**Scope:** static/unit only (no product smoke, no SoftBlur/MediaSession edits)

## Commands

### 1. `./scripts/dev-smoke.sh --unit`

| Field | Value |
|-------|--------|
| **Exit** | `0` |
| **Verdict** | `dev-smoke PASS (unit only)` |

**Steps (all ✓):**
- test-connect-ui
- test-friend-invite
- test-geo-localize
- unit callMetrics.test.mjs
- unit connectSteps.test.mjs
- unit hubLobby.test.mjs
- unit matchContinuity.test.mjs
- unit matchPeers.test.mjs
- unit partnerIdentityDisplay.test.mjs
- unit stageStreams.test.mjs
- unit blurMode.test.mjs
- unit giftFxHold.test.mjs

**Tail:**
```
=== dev-smoke PASS (unit only) ===
EXIT_dev_smoke_unit=0
```

### 2. `node mobile/scripts/verify-match-ux.mjs`

| Field | Value |
|-------|--------|
| **Exit** | `0` |
| **Verdict** | `L0 done: 30 ok, 0 fail` |

**Tail (last checks):**
```
  OK  LiveBottomBar live-blur-btn + onToggleBlur
  OK  ui/live.html cache-bust live.js?v=572 webrtc.js?v=315
  OK  ui/live.js has hop9 stuck-offer recovery markers
  OK  MediaSession hasRemoteSdp uses real remote SDP (not latch alone)
L0 done: 30 ok, 0 fail
EXIT_verify_match_ux=0
```

## Summary

| Check | Exit | Result |
|-------|------|--------|
| `./scripts/dev-smoke.sh --unit` | 0 | PASS |
| `node mobile/scripts/verify-match-ux.mjs` | 0 | PASS (30/30) |

**Unit/static L0: both green.**  
Does **not** claim product.ok, SoftBlur live smoke, multi-pair faces, or Play↔PC connect PASS.

## Files changed

- None (verify-only).

## Risks / merge

- None. Read-only verification.
- Card may be harvested as COMPLETE evidence for L86 unit gate only.

## Must-not compliance

- No SoftBlur/MediaSession thrash
- No force-push / APK / adb
- No live.js dual-write
- No invented blur/multi product PASS
