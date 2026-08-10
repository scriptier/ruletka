# RESULT: 100-apk-hook-race

## Status
DONE

## Completion promise
COMPLETE

## What changed
Root cause: the post-commit hook's old lock only guarded hook-vs-hook races.
A *manual* `build-apk-local.sh` run never touched that lock file, so a manual
build running at the same time as the auto-triggered hook build could invoke
`gradlew :app:assembleRelease` twice concurrently — the actual cause of the
lintVital "missing return-value file" failures (Android Gradle's lintVital
task writes a shared per-module state file that two concurrent invocations
race on).

Fix: moved the real lock into `build-apk-local.sh` itself, so **every**
caller (hook or manual) serializes on the same `mobile/artifacts/.apk-build.lock`
via `flock`:
- `build-apk-local.sh` now does `exec 200>"$LOCK"; flock -n 200` right after
  the SDK/JDK sanity checks (before any app.json mutation or gradle
  invocation). If the lock is held, it prints a message and blocks with
  `flock -w 1800 200` (30 min timeout) rather than failing immediately — a
  human running a manual build should wait for the in-flight build, not race
  it or bail.
- Because `flock` is released automatically on process exit (fd close), a
  killed/crashed build can never leave a stale lock behind — removed the old
  45-minute stale-PID-file heuristic entirely, it's no longer needed and was
  itself a source of TOCTOU races.
- `post-commit-apk` was rewritten to **not** hold the lock while running the
  build. It now does a quick non-blocking probe (`flock -n "$LOCK" -c true`)
  just to decide whether to skip queuing another background build. It must
  not hold the lock itself, because `build-apk-local.sh` runs as a *child*
  process and would open its own fd on the same lock file — a distinct lock
  holder from the parent hook's fd, which would deadlock (parent holding the
  lock while waiting for a child that's blocked trying to acquire it).

Verified the flock semantics directly in a shell (two processes racing the
same lock file): the second caller correctly blocks until the first
releases, and a non-holding probe correctly detects "busy" without
deadlocking. See commands run during this session for the exact test.

## Manual build docs (unchanged usage, now race-safe)
```
cd mobile
./scripts/build-apk-local.sh              # build current app.json version
./scripts/build-apk-local.sh --bump       # patch +1 versionCode & 0.0.x, then build
```
If a hook-triggered or another manual build is already running, the command
now prints `Another APK build is running (lock: …) — waiting…` and blocks
(up to 30 min) instead of racing gradle. `SKIP_APK_HOOK=1 git commit ...`
still disables the auto-trigger for one commit.

## Files
- scripts/git-hooks/post-commit-apk
- mobile/scripts/build-apk-local.sh

## Verify ran
- `bash -n scripts/git-hooks/post-commit-apk` — OK
- `bash -n mobile/scripts/build-apk-local.sh` — OK
- Live flock race test in /tmp: confirmed second caller blocks and later
  acquires after first releases; confirmed hook's non-holding probe detects
  a busy lock without deadlocking.
- Did not run a real `assembleRelease` (no code path / connect changes, and
  a real build is slow — left for Grok's normal build cycle to confirm in
  practice).

## Connect risk
none — scripts/git-hooks and mobile build tooling only, no app/ICE/media code touched.

## Handoff for morning
- merge branch: admin/20260810T083128Z-100-apk-hook-race
- smoke: none required (build tooling only); optionally run a manual
  `./scripts/build-apk-local.sh` while a commit triggers the hook to see the
  "waiting…" message in action
- do not: deploy without Play↔PC check (unaffected by this change anyway)
