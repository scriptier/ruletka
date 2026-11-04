# W4b build-aab-local.sh path check (no build)

## Goal
Document whether `./scripts/build-aab-local.sh` (or mobile equiv) is runnable; keystore present; do **not** build unless already safe dry-run.

## OWN
- `docs/PLAY_UPLOAD.md` or `knowledge/specs/FINISH-PLAY-MULTI.md` one honest note
- Prefer RESULT-only if docs already honest

## Work
1. Locate AAB script + keystore path; ls artifacts AABs.
2. RESULT: how to build when human asks; tip still MISSING for 0.1.366.
3. **Do not run full AAB build** (slow / signing).

## Must not
- Long build without human, push secrets, Play upload
