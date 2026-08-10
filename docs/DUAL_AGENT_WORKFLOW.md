# Dual-agent workflow: Grok Build + Claude Code

## Goal

Ship **ruletka** (Play app ↔ browser WebRTC) faster without two AIs fighting over the same files.

> **Maximum Claude utilization (daytime factory):** see **[`AGENT_GROK_CLAUDE.md`](./AGENT_GROK_CLAUDE.md)**  
> Commands: `./scripts/agents/status.sh` · `./scripts/agents/loop.sh 3` · `./scripts/agents/dispatch.sh --wait`

## Roles (hard split)

| Role | Agent | Owns |
|------|--------|------|
| **Director / ops** | **Grok Build** | Priority, plans, production SSH, hub/TURN logs, deploy, emulator/adb, APK install paths, pair-test, “did media land?” |
| **Implementer** | **Claude Code** | Scoped code edits in repo, refactors, reviews, alternate designs, unit-level fixes |
| **Human** | **You** | Smoke-test phone↔PC, approve product calls, install APKs, hard-refresh browser, say “still stuck” |

### Grok never hands Claude
- Live deploy keys / `push.sh` without review
- Blind rewrites of whole `live.js` without a task brief
- Parallel edit of the same file Claude is editing

### Claude never owns alone
- Production deploy
- Interpreting coturn/hub journal without Grok
- “Just ship whatever” without a success criterion

## Priority stack (current)

1. **P0 — Connectivity:** Play ↔ browser both cameras + audio, one offer/answer, &lt;20s  
2. **P1 — Stability:** no “Connection weak — reconnecting” thrash  
3. **P2 — Ship path:** Play internal track when video is reliable  
4. **P3 — Polish:** UI, watermarks, social (only after P0 green)

## Cadence (one loop = 15–40 min)

```
1. GROK: diagnose (logs / hub / emu) → write TASK.md
2. CLAUDE: implement ONLY that task in freenet-roulette
3. GROK: review diff, build APK if mobile, deploy hub/UI if server
4. YOU: smoke test (or Grok emu pair-test)
5. GROK: mark pass/fail → next task or hotfix
```

**Rule:** one writer at a time. The other waits or reviews.

## How to invoke Claude

```bash
export PATH="$HOME/.local/bin:$PATH"
cd /home/drakosik/freenet-roulette
claude -p "$(cat /tmp/claude-task.md)" --output-format text
# interactive:
claude
```

Grok prepares `/tmp/claude-task.md` with:
- Goal + success criteria  
- Allowed files  
- Forbidden (UI branding, bulk APK on site, etc.)  
- What not to undo (recent fixes)

## Task template (for Claude)

```markdown
# Task: <one line>
## Success
- <measurable>
## Context
- <2–5 bullets from Grok diagnosis>
## Files (prefer only these)
- path/...
## Do not
- ...
## Already shipped (do not undo)
- ...
```

## File ownership hints

| Area | Prefer |
|------|--------|
| `bridge/`, deploy, coturn, production | **Grok** |
| `mobile/src/media/`, `ui/webrtc.js` deep SDP | **Claude** (Grok reviews + deploys) |
| `ui/live.js` large | **Split:** Claude small functions; Grok integration |
| Emulator / APK / pair-test | **Grok** |
| Design / “why black video” analysis | Either; Grok has live logs |

## Parallel work that is safe

While Claude codes **task A**, Grok can:
- Watch hub journals  
- Run pair-test against **deployed** code (not uncommitted Claude WIP)  
- Write next TASK  
- Prepare APK version bump  

Do **not** both edit `MediaSession.ts` in the same hour.

## Communication with human

- **still stuck** + stay matched → Grok pulls hub offer/answer count  
- **claude ok** → CLI ready  
- **pass / fail** after each smoke test  

## Current connectivity baseline (2026-08-07)

- APK **0.1.111** — `startCall` mutex, single-offer latches, 15s iceRestart grace  
- Deploy **startcall-mutex** — browser `_offerSentOnce`, skip thrash re-offers  
- Hub: `force_relay` not always-on; match settle 12s  
- Success metric: hub log = **1 offer + 1 answer** per match; both sides see video  

## First loops after this doc

1. Human smoke **0.1.111** + hard-refresh browser  
2. If fail: Grok hub forensics on that match  
3. Claude: next scoped fix from forensics (not a full rewrite)  
4. Grok ship APK/deploy → retest  
EOF
