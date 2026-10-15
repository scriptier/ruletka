# W4 PLAY_* docs tip restamp

## Goal
Play ops docs no longer claim ancient **0.1.22x–0.1.28x** as current tip. Honest tip = **0.1.366 / vc374** sideload APK; **AAB for tip MISSING**.

## OWN
- `docs/PLAY_INTERNAL_TEST_CHECKLIST.md`
- `docs/PLAY_OPS.md`
- `docs/PLAY_POLISH_PLAN.md`
- `docs/PLAY_TODAY.md`
- `docs/PLAY_UPLOAD.md`
- Optionally `docs/PLAY_DATA_SAFETY.md` tip line only if version-stale

## Work
1. Read `mobile/app.json` → versionName/versionCode.
2. Update ship tip / version tables to **0.1.366 · vc374**.
3. APK paths: `mobile/artifacts/ruletka-0.1.366-vc374.apk` / `ruletka-latest.apk` when present.
4. Explicitly mark **AAB tip MISSING** for 0.1.366 (do not invent aab filename).
5. Keep Console / Internal track steps as human open — no invent Console PASS.

## Done criteria
- [ ] No remaining "current tip" of 0.1.28x / 0.1.22x as ship tip (historical notes OK if labeled historical)
- [ ] RESULT + COMPLETE
- [ ] Connect risk: none

## Must not
- Build AAB/APK, deploy, push, Play Console upload
