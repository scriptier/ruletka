# Branches (inventory 2026-11-04)

Baseline: `release/2026-10-10` = `9aa5a7b` = what is **live** (tag
`deployed-2026-11-04`; prod `deploy.json` UI stamp `20261104T033426Z-3efd3ac`,
bridge from 9aa5a7b). "Ahead" = commits not in release.
Nothing was deleted, moved or pushed by this tidy-up. Delete only with Anton's OK.

## The one to use: `integrate/2026-11-04` (worktree `freenet-roulette-unified`, local only)

Real merges on top of 9aa5a7b:

| Merge | What it brings |
|---|---|
| `feature/genital-ban-2026-11-04` (34fff3d, includes `feature/face-check-2026-11-04`) | web face check (no face -> no stranger match), on-device genital detector (NudeNet 320n, AGPL), hub auto-ban. See `docs/FACE_CHECK_2026-11-04.md`, `docs/GENITAL_BAN_2026-11-04.md`. **Not deployed yet.** |
| `app/combined-2026-11-04` (ec09df2) | the RuStore app line: `token-diet-20261015` (0.1.480 base, session/token-thin docs, ~2k task cards under `tasks/`) + PiP split + hub ban screen, app **0.1.481 / vc489** |
| `feature/pip-split-2026-11-04` (a34fe19) | same change as in app/combined (cherry-picked there); merged to record it, empty diff |

Conflict policy in the app/combined merge (full list in commit 5a8b6d8):
web `ui/*`, bridge, coturn/TURNS units, `verify-match-ux.mjs`, wiki log -> **release side**
(app/combined only had the Oct 10 snapshot of those; release has Oct 11 - Nov 4 on top).
`mobile/app/live.tsx`, `mobile/src/live/*`, `mobile/app.json`, AGENTS.md, CLAUDE.md -> **app side**.
`.gitignore` = union (+ `!ui/vendor/**/*.min.js` so the token-diet `**/*.min.js` rule does not hide vendored files).

Cache pins in integrate: `live.js?v=991`, `i18n.js?v=277` (live: 989/275),
`live-stage.css?v=658`, `live-brand.css?v=26`, webrtc 356, hubs 157, identity 156.

Fixes on top: stale `?v=` test pins, mobile `tsc` 23 -> 0 errors (three were real
runtime bugs, see commit 8685f05), push.sh no `--delete` on bin/ui, install-on-server
apt 402 tolerance, opt-in APK hook, `scripts/deploy.sh`, `scripts/deploy/turn-alloc-test.py`,
5 note files copied from polish/2026-10-10.

## Status of every branch

| Branch | Tip / date | Status |
|---|---|---|
| `release/2026-10-10` | 9aa5a7b 11-04 | **LIVE.** Base of integrate. |
| `fix/relay-2026-11-04` | 9aa5a7b 11-04 | = release. Merged. Safe to delete later. |
| `safety/2026-11-03` | 3efd3ac 11-03 | ancestor of release. Merged. Safe to delete later. |
| `main` | 396d32f 08-26 | ancestor of release (old). Decide: fast-forward main to integrate. |
| `feature/face-check-2026-11-04` | 8cc225d | inside genital-ban -> in integrate. Safe later. |
| `feature/genital-ban-2026-11-04` | 34fff3d | in integrate. Safe later. |
| `feature/pip-split-2026-11-04` | a34fe19 | in integrate (via app/combined). Safe later. |
| `app/combined-2026-11-04` | ec09df2 | in integrate. Safe later. |
| `token-diet-20261015` | 21129b2 10-15 | in integrate (via app/combined). **Main tree is checked out on it**; keep until main tree moves. |
| `omarchy-migration-wip-20261015` | 6776b61 | strict ancestor of token-diet. Superseded, safe later. |
| `polish/2026-10-10` | 261d576 10-13 | **NOT merged.** 81 commits (site SEO pages, app copy/i18n, on-device safety stub, language picker, store-listing drafts). Most of the site/i18n text already reached release via the Oct 10 snapshot + Oct 11-13 polish; 76 of 81 commits no longer apply. Unique leftovers: `mobile/src/safety/{logic,logStore}`, `mobile/src/i18n/{duration,LanguagePickerModal}`, `mobile/src/nav/HomeHeaderActions.tsx`, idle-start camera/trust lines. Needs a human pick, not a blind merge. Keep. |
| `polish/ml-native` | ef08f1e 10-10 | ML experiment, left out on purpose. Keep. |
| `claude/p0-connectivity`, `claude/q-and-ui`, `claude/q-i18n`, `claude/q-tests` | Aug | 0 ahead: fully merged. Safe later (each has a worktree). |
| `backup/*-head` (9) | Aug 5-10 | 0 ahead: merged. Safe later. |
| `backup/*-wip` (7) | Aug 7-10 | one WIP snapshot commit each (agent logs, config.env). Stale; safe later once Anton confirms nothing is wanted from config.env. |
| `admin/*` (28) | Aug 7 - Oct 9 | admin-agent experiments, 1-2 commits each on old bases, mostly task cards + small edits that conflict now. 3 are already absorbed (100-aab-0283-build, 100-multi-skill-blur-crosslink, 005-auto-zero-offer). Not merged. Safe later. |

Tags: `deployed-2026-10-10`, `-10-13`, `-11-03`, `-11-04` (lightweight). Keep.

## Safe to delete later (with Anton's OK), branch + worktree

- worktrees `freenet-roulette-relay`, `-safety`, `-face`, `-nsfwban`, `-pip`, `-claude`, `-claude-q-and-ui`, `-claude-q-i18n`, `-claude-q-tests`, and all 28 `freenet-roulette/.admin-worktrees/*`
- branches `fix/relay-2026-11-04`, `safety/2026-11-03`, `feature/face-check-2026-11-04`, `feature/genital-ban-2026-11-04`, `feature/pip-split-2026-11-04`, `omarchy-migration-wip-20261015`, `claude/*`, `backup/*`, `admin/*`
- after integrate becomes main: `app/combined-2026-11-04` (+ `freenet-roulette-app`), `token-diet-20261015` (after the main tree is switched)

Keep: `release/2026-10-10` (live), `integrate/2026-11-04`, `polish/2026-10-10`, `polish/ml-native`, all `deployed-*` tags.

## Main tree `freenet-roulette` (not touched)

On `token-diet-20261015`. Three untracked files, on no branch:
- `.claude/settings.local.json` - local Claude Code settings (Aug 26). Personal; leave or gitignore.
- `herdr-plugin/spec-panes/__pycache__/spec_panes.cpython-312.pyc` - Python bytecode. Junk.
- `ui/download/SHA256SUMS.new` - Aug 23 checksum fragment for 0.1.471 vc479; superseded by tracked `SHA256SUMS` (0.1.475). Junk.

Also: `.git/hooks/post-commit` there is a Cygwin "IntxLNK" symlink file that git cannot run
(commits print an error, the APK hook never ran). Fix when convenient:
`mv .git/hooks/post-commit .git/hooks/post-commit.broken && scripts/git-hooks/install-apk-hook.sh`
(the hook is now opt-in: `git config ruletka.apkHook true`).

## Deploy

`scripts/deploy.sh --dry-run --bridge <binary built on the Grok box>` first, then without `--dry-run`.
Hub before web is required for face check / genital ban. `push.sh` is now only the first-install path.
