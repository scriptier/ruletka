# Task: tools for better connect diagnostics (research + doc)

## Spec
Tonight’s fails (hub, not vibes): **recvonly** offers (no camera), **ghost WS** (no answer), extra tabs / same user_id, one-way frames, Friend Call “offline”, leftover Start. We already have `./scripts/av-verify.sh`, `artifacts/av-verify/`, `ui/admin-connect.html`, hub `av_path` logs, `docs/AV_FIX_SUBAGENT_PLAN.md`.

## Goal
Write **one** director cheat-sheet: what we already have, what’s missing, cheapest next tools. No ICE thrash. No new always-on force_relay.

## OWN (write only)
- `docs/CONNECT_DIAGNOSTICS.md` (create)

## Read (do not rewrite)
- `docs/AV_FIX_SUBAGENT_PLAN.md`
- `docs/CONNECTIVITY_LOCK.md` (pool=0)
- `scripts/av-verify.sh` (header / flags only)
- `ui/admin-connect.html` (what it already shows)
- `knowledge/wiki/gotchas.md` (first 80 lines)

## Must not
- MediaSession.ts, live.tsx, webrtc.js, pool>0, deploy, APK, eas build
- invent product.ok / GOAL_MET
- install random SaaS without saying “needs human API key”

## Cover these gaps from 2026-08-25 smoke
1. **recvonly / sendonly** — see it in admin UI without grepping journal
2. **no answer in N seconds** — zombie partner
3. **same user_id two sockets** / extra tabs
4. **one-way frames** (in>0 out=0) labeled as product FAIL
5. **Friend Call offline** vs they are waiting_solo
6. Client: Chrome `chrome://webrtc-internals` one-liner for testers
7. Optional: hub `/v1/admin/live` JSON (describe only — don’t implement unless a 20-line stub fits OWN; prefer doc)

## Done
- [ ] CONNECT_DIAGNOSTICS.md: table Now vs Gap vs Tool (command or page)
- [ ] Ranked 5 next tools (1 = cheapest)
- [ ] RESULT + COMPLETE
