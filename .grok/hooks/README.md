# Project hooks (Marchese Layer 3 — hard walls)

Requires **folder trust**: run `/hooks-trust` once in this repo (or `grok --trust`).

| File | Role |
|------|------|
| `never-rules.json` | PreToolUse Never walls + SessionStart reminder |
| `scripts/pretool-never.sh` | Deny: `push.sh`, `iceCandidatePoolSize>0`, unprompted git APK hook install |
| `scripts/session-start-agentic.sh` | Remind agentic loop + active A/V spec |

## Verify

```bash
/hooks-list
# or
python3 -c 'print("hooks present")' && ls .grok/hooks/
```

Soft preflight remains: `./scripts/agentic-check.sh`.

**Not blocked (Ask first, human may authorize):** site APK upload, coturn conf, hub force_relay policy — still in AGENTS Ask-first.
