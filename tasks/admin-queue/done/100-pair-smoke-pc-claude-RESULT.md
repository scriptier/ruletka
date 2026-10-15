# Claude: PC pair-smoke attempt — RESULT

Status: BLOCKED

## Why
`scripts/pair-smoke.mjs` does not exist in this worktree (`claude/p0-connectivity`, HEAD `349970c`). Checked:
- Not present anywhere under `scripts/` (`find . -iname "pair-smoke*.mjs"` → no match).
- Not present at the branch's merge-base with `main` (`git merge-base HEAD main` = `349970c`) — confirmed absent there too.
- It *does* exist on `main` / `origin/main` (added in commits `5ca476a`, later touched in `61aeb70`), which this branch never picked up.

This is not a script-path typo I can fix in scope ("tiny fix only if script path bug") — the file itself is missing from the branch's history. Pulling it in would mean cherry-picking/merging unrelated main commits into this worktree, which is outside OWN and risks touching connectivity-adjacent code without review.

## Environment check (for the record — other prerequisites are fine)
- Chrome: present — `google-chrome` 151.0.7922.108 at `/usr/bin/google-chrome`.
- Bridge: present — `ui/download/roulette-bridge-linux-amd64` (ELF binary, executable) and `bridge/` (Rust source, `Cargo.toml`).
- Only the pair-smoke script itself is missing.

## Files touched
None (investigation only; no code changes made).

## Verify commands run
- `find . -iname "pair-smoke*.mjs" -not -path "*/node_modules/*"` → no results
- `git log --all --oneline -- scripts/pair-smoke.mjs` → present in main-branch history, not in this branch's ancestry
- `git show main:scripts/pair-smoke.mjs` → EXISTS in main
- `git merge-base HEAD main` → `349970c`; `git show 349970c:scripts/pair-smoke.mjs` → NOT present
- `google-chrome --version` → `Google Chrome 151.0.7922.108`
- `ls ui/download/roulette-bridge-linux-amd64` → present, executable

## Connect risk
none (no code changed; nothing run against live connectivity/ICE/TURN)

## Exit code
N/A — pair-smoke was never invoked; blocked before run due to missing script.

BLOCKED
