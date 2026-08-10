# Task: Harden post-commit APK hook against dual gradle race

## Goal
Stop concurrent `assembleRelease` (post-commit + manual) failing on lintVital missing return-value file.

## Scope (only these)
- scripts/git-hooks/post-commit-apk
- scripts/git-hooks/install-apk-hook.sh if needed
- Optional: flock / skip if gradle already running / disable lintVital race

## Done criteria
- [ ] Hook refuses to start second build OR uses flock
- [ ] Document how to build manually in RESULT
- [ ] No connect/ICE changes
- [ ] COMPLETE, connect risk none

## Do not
- Force deploy, change app code paths
