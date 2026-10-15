# Agent lanes (Grok + Claude)

## Grok

| Role | Mode | Owns |
|------|------|------|
| diagnose | read-only | scorecard, journals |
| verify-only | RO + execute | av-verify only |
| client-ice | write | webrtc / MediaSession / live.tsx |
| turn-media | write limited | coturn + lock scripts |

Plugin: `ruletka-connect`. Job cards: `./scripts/av-loop.sh` → `artifacts/av-loop/`.

## Claude

Worker only — not director.

```bash
claude -p "$(cat artifacts/av-loop/claude-job.md)" --print \
  --allowedTools "Read,Edit,Grep,Glob,Bash" \
  --add-dir "$(pwd)"
```

Before edit: **read** `knowledge/specs/current-av.md` (if A/V) + relevant `knowledge/wiki/*.md`.  
After edit: Grok re-runs av-verify.  
After solid diagnosis: `/knowledge-compound`.

## Max hops

2 implementers without new human smoke → STUCK.

### Log

- 2026-08-14: **herd** `20260814T020528Z` connect-safe cleanup — Grok director + 4 grok-sub + Claude **479** (tests only). All 5 lanes **done / GOAL_MET=yes**. OWN: one writer `MediaSession.ts` (ms-safe). Claude OWN = test files only. P1 extract **docs only**. See [connect-cleanup](connect-cleanup.md). **No product.ok / APK.**
- 2026-08-12 overnight-2: Claude Code **session limit** held earlier (~12:20am America/Edmonton — `100-claude-session-limit-RESULT` / hold-2). Continuous shift post-reset draining admin connect queue: **450** android-answer recommend **DONE** (docs/RESULT only — `450-connect-android-answer-recommend-RESULT`); **451** web-kick recommend + **452** product one-way critic still **pending** at compound time. Grok wiki compound does not invent PASS from Claude recommend cards.
- 2026-08-10: dual Grok+Claude MediaSession write needs reconcile (gotcha #7).
- 2026-08-20 (task 543): wiki lane reminder — compounding an ICE/`force_relay` finding is **read + document only**; even when confirming code is already correct (Find-3rd `pair_force_relay`), the wiki lane must not touch `live.js` / `bridge/src/simple.rs`. See [multi-party.md](multi-party.md) + [force-relay-same-lan.md](force-relay-same-lan.md).
