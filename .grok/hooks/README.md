# Project hooks (Marchese Layer 3 — hard walls)

Requires **folder trust**: run `/hooks-trust` once in this repo (or `grok --trust`).

| File | Role |
|------|------|
| `never-rules.json` | PreToolUse Never walls + SessionStart reminder |
| `scripts/pretool-never.sh` | Deny: `push.sh`, `iceCandidatePoolSize>0`, unprompted git APK hook install |
| `scripts/session-start-agentic.sh` | SessionStart **and** PostCompact: write `.grok/session-card.txt` from live pins (stdout is ignored) |

## Verify

```bash
/hooks-list
# or
python3 -c 'print("hooks present")' && ls .grok/hooks/
```

Soft preflight remains: `./scripts/agentic-check.sh`.

**Not blocked by hook (AGENTS Never / Ask):** site APK upload is **human-gated in AGENTS** (do not rsync APK to `/download/` unless they say **put apk on the site**). Coturn conf, hub force_relay policy — Ask first.
