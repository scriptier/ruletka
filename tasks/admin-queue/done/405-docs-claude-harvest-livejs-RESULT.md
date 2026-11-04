# 405 — Docs: document harvest paths for multi-party polish — RESULT

## Status
DONE

## Files touched
- `docs/AGENT_GROK_CLAUDE.md` — added a "Multi-party stage + harvest ownership"
  section (inserted between "Parallelism (safe)" and "Sleep shift"):
  - Pointer to `.grok/skills/multi-party-stage/SKILL.md` (Grok-side skill,
    not in Claude's worktree) for any 3-way/4-way/find-third task, plus the
    hard rule (never unmount the live partner `RTCView` for a hunt/trio
    layout).
  - Confirmed current `AGENTS_HARVEST_PATHS` (from `scripts/agents/lib.sh`)
    already includes `mobile/src`, `mobile/app`, `mobile/scripts`, i18n,
    `ui/live-stage.css`, `ui/live.html`, `ui/style.css`, `docs`,
    `scripts/agents`.
  - Called out that `ui/live.js` and `ui/webrtc.js` are **not** in
    `AGENTS_HARVEST_PATHS` — Grok OWN by default; Claude edits there won't
    harvest unless a task explicitly says so.
  - One-line pointer to the sleep-shift/continuous queue for where
    multi-party polish work should normally land.

Did not also edit `CLAUDE-WORKFLOW.md` or `docs/AGENT_LOOP_DESIGN.md` —
task said "one file prefer" and `AGENT_GROK_CLAUDE.md` already owns the
harvest/parallelism/ownership tables this note belongs next to.

## Verify commands run
- `grep -n "AGENTS_HARVEST_PATHS" -A 15 scripts/agents/lib.sh` — confirmed
  exact harvest path list before writing the doc note (no code changed).
- Read `.grok/skills/multi-party-stage/SKILL.md` (main tree, read-only) and
  `tasks/admin-queue/done/400-android-findthird-hunt-polish*.md` for
  accurate skill name/path and context.
- Visual re-read of the diff in `docs/AGENT_GROK_CLAUDE.md`.

## Connect risk
none — docs-only change, no code touched.

## Merge advice
Safe to fold in directly; pure markdown addition, no conflicts expected.

## Completion promise
COMPLETE
