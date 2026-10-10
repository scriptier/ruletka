# CLAUDE.md — always-on rules for ruletka agents

Keep this file short. Claude Code loads it every session.

## Karpathy method (required)
You sit under **Grok director** on the project agent OS (not free-form vibe coding).

| Layer | You do |
|-------|--------|
| **Spec** | Read task Goal / OWN / Must not / Done. Prefer `knowledge/specs/*` DONE WHEN when cited. |
| **Verifier** | Run task-local checks when listed. Write **RESULT** with evidence. Never invent product.ok / GOAL_MET. |
| **Environment** | Follow AGENTS Always/Ask/Never; cite wiki; compound only when task says so. |

Wiki: `knowledge/wiki/karpathy-method.md`. Connect: `docs/CONNECTIVITY_LOCK.md` + av-verify scorecard before ICE thrash.

**Session start:** `.grok/session-card.txt` then `knowledge/wiki/now.md`, then **only** the spec that matches the task. Do not open every `current-*.md`. Do not load SMOKE-NEXT unless the human is pasting smoke. Paint-only HUD (one CSS / pin bump) skips spec and wiki.

## Product
- **ruletka.vip**: Expo Android (Play) ↔ browser WebRTC video chat
- Repo: `/home/drakosik/freenet-roulette`
- Lead: Grok Build. You implement scoped tasks only.

## #1 priority
Play ↔ PC: both cameras + audio, **fast** connect. See `docs/CONNECTIVITY_LOCK.md` and `docs/ROADMAP_PLAY_BROWSER.md`.
Before hub / ICE / MediaSession changes: `./scripts/test-connectivity-lock.sh` (must pass) + phone+PC smoke.

## Hard never
1. Production deploy (rsync, systemctl, coturn, droplet)
2. `git push` / force-push / merge to `main`
3. Website APK (`ui/download/` or droplet `/opt/ruletka/ui/download/`) unless the human says **put apk on the site** / **update website apk**. Local `--bump` is not a site publish.
4. Undo CONNECTIVITY_LOCK (no always-on force_relay, no docker coturn revival, no double-offer thrash)

## Prefer editing
- `mobile/src/media/*`, `mobile/app/live.tsx`
- `ui/webrtc.js`, `ui/live.js`, `ui/geoLocalize.js`
- `docs/*`, `scripts/*`, `tasks/*`

## Workflow (every task)
1. **Plan** briefly (3–7 bullets) before large edits
2. **Implement** minimal diff for one concern
3. **Verify** when possible (`node` geo test, `tsc --noEmit`, task-local scripts)
4. **Commit** only if instructed (overnight agent may commit on `admin/*` branch)
5. Write a **RESULT** markdown with: what changed, files, risks, merge advice

## Parallel agents
If another agent may be editing the same repo: only fix files **you** changed. Do not “helpfully” refactor unrelated lint/build noise.

## Human gate
Smoke Play↔PC + merge + deploy are **human/Grok**, never unsupervised overnight.

## Local APK (Grok owns; Claude does not build)
- After meaningful `mobile/` changes, Grok runs:  
  `cd mobile && ./scripts/build-apk-local.sh --bump`  
  See `docs/MOBILE_BUILD.md`.
- Claude: never deploy, never Play upload, never bulk APK on site.
