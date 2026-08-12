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

- 2026-08-10: dual Grok+Claude MediaSession write needs reconcile (gotcha #7).
