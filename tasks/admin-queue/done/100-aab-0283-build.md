# Task: Build Play AAB 0.1.283 if possible

## Goal
Produce sideload-ready AAB for Internal testing handoff (no Play upload).

## Scope
- `cd mobile && ./scripts/build-aab-local.sh --version 0.1.283 --code 291` (or project equivalent)
- If keystore missing: document blocker in RESULT, do not invent secrets
- Copy/link under mobile/artifacts/ if build succeeds

## Done criteria
- [ ] AAB path listed OR explicit blocked reason
- [ ] No Play Console upload
- [ ] No production deploy
- [ ] COMPLETE

## Do not
- Upload to Play, change signing secrets, deploy hub
