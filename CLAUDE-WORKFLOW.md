# Dual-agent workflow: Grok Build (lead) + Claude Code

Also read root **`CLAUDE.md`** (always-on) and **`docs/AGENT_FACTORY.md`** (overnight factory).

## Roles
- **Grok Build**: plan, production hub/TURN logs, deploy, APK, merge decisions
- **Claude Code**: scoped code/docs/tests only
- **You**: install APKs, hard-refresh browser, smoke Play↔PC

## Project
`/home/drakosik/freenet-roulette` — ruletka.vip (Expo Android + browser WebRTC)

## #1 priority
Play ↔ PC browser: both cameras + audio, **fast** connect. See `docs/ROADMAP_PLAY_BROWSER.md` and `docs/CONNECTIVITY_LOCK.md`.

## Current baseline (2026-08-07)
- APK **0.1.123** in `mobile/artifacts/ruletka-latest.apk`
- UI deploy includes `kickSoloWebRtc` + geo localize
- Hub logs `match_to_offer_ms`, `platform_a/b`, offer debounce
- Overnight admin agent **v4** (Ralph retry + worktree auto-commit)

## Claude session rules
1. One task file under `tasks/*.md` or `tasks/admin-queue/pending/` per run
2. Minimal diffs; no branding redesign
3. Prefer: `mobile/src/media/*`, `mobile/app/live.tsx`, `ui/webrtc.js`, `ui/live.js`, i18n/geo, scripts, docs
4. **No** production deploy, **no** bulk APKs on website
5. Write RESULT with Status + files + connect risk (+ `COMPLETE` if done)

## Overnight
```bash
./scripts/admin-agent/status.sh
./scripts/admin-agent/morning.sh
```

## How Grok launches Claude (prefer agent factory)
```bash
cd /home/drakosik/freenet-roulette
./scripts/agents/status.sh
./scripts/agents/loop.sh 3              # drain up to 3 pending
# or one task:
./scripts/agents/dispatch.sh --wait tasks/admin-queue/pending/054-….md
# docs: docs/AGENT_GROK_CLAUDE.md

# legacy:
claude -p "$(cat tasks/foo.md)" --output-format text \
  --allowedTools "Read,Edit,Write,Bash,Glob,Grep"
# or enqueue for overnight:
./scripts/admin-agent/enqueue.sh 030 "slug"
```

## Active parallel tracks
| Track | Owner | Task |
|-------|--------|------|
| Connectivity speed | Grok | C1–C3 in roadmap |
| Admin factory overnight | cron | `scripts/admin-agent/` |
| Parity / pair smoke | Claude queue | `tasks/admin-queue/pending/` |
