# Claude handoff — 2026-08-09 (after fast-connect pass)

## Status
**HUMAN PASS:** Play↔browser cameras linked **fast** on **0.1.189 / vc197**.

Hub (recent): offer ~250–850ms, answer ~0.8–1.3s, **0** android dual-offer SLOW, thrash drops 0.

## Role split (money-worth dual AI)

| Agent | Owns now |
|--------|-----------|
| **Grok** | Production hub/TURN, deploy, APK ship, connect hot path if regression |
| **Claude** | Queued tasks in `tasks/admin-queue/pending/050–053` — **no** MediaSession/webrtc/live kickSolo thrash |

## Run Claude (worktree)

```bash
export PATH="$HOME/.local/bin:$PATH"
cd /home/drakosik/freenet-roulette

# one task at a time preferred; worktree isolates edits
./scripts/claude-run.sh tasks/admin-queue/pending/050-settings-last-connect-timing.md
# or interactive in worktree:
# cd ~/freenet-roulette-claude && claude
```

After Claude finishes: Grok reviews RESULT, merges, optional APK if mobile UI.

## Priority queue for Claude
1. **050** Settings last-connect timing (user-visible, low risk)
2. **052** hub-match-speed answer metrics (ops)
3. **053** pair-smoke budgets (regression)
4. **051** DEVICE_SMOKE 189 baseline (docs)

## Forbidden for Claude this sprint
- `mobile/src/media/MediaSession.ts` ICE/offer/retry
- `ui/webrtc.js` / `ui/live.js` kickSolo / force_relay
- `bridge/src/simple.rs` pair_force_relay
- production `push.sh` without Grok

## If connect regresses
Tell Grok: “still stuck” + stay matched → hub forensics. Do **not** let Claude “fix connect” blindly.
