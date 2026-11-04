# W4 PLAY_* docs tip restamp — RESULT

**Status:** COMPLETE  
**Connect risk:** none  
**Date:** 2026-08-11

## What changed

Restamped Play ops docs so **ship tip** matches working tree `mobile/app.json`:

| Field | Value |
|-------|--------|
| versionName | **0.1.366** |
| versionCode | **374** |
| APK (present) | `mobile/artifacts/ruletka-0.1.366-vc374.apk` · `ruletka-latest.apk` · `ruletka-android-latest.apk` |
| AAB for tip | **MISSING** (no invent; only ancient 0.1.0–0.1.3 AABs on disk) |

Removed **current tip** claims of **0.1.22x / 0.1.28x** (historical labels only where useful).  
Console / Internal upload steps remain **human open** — no Console PASS invented.

## Files touched

| File | Change |
|------|--------|
| `docs/PLAY_INTERNAL_TEST_CHECKLIST.md` | tip 0.1.366/vc374; AAB MISSING; APK paths; human Console |
| `docs/PLAY_OPS.md` | current binary table restamp; historical 0.1.22x/28x note |
| `docs/PLAY_POLISH_PLAN.md` | ship tip + AAB MISSING; 0.1.221 labeled historical |
| `docs/PLAY_TODAY.md` | day plan restamp; smoke/install paths for tip |
| `docs/PLAY_UPLOAD.md` | ship tip + binaries; release name example 0.1.366 (374) |
| `docs/PLAY_DATA_SAFETY.md` | **not edited** (no version tip lines) |

## Done criteria

- [x] No remaining "current tip" of 0.1.28x / 0.1.22x as ship tip (historical notes labeled)
- [x] RESULT with COMPLETE
- [x] Connect risk: none

## Risks / merge advice

- Docs-only; safe to merge anytime.
- Next human step for Play: build AAB (`cd mobile && ./scripts/build-aab-local.sh`) then Internal upload — not done by this task.

## Must not (honored)

- No AAB/APK build, deploy, push, or Play Console upload.
