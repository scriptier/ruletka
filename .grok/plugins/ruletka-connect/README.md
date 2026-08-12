# ruletka-connect (Grok plugin)

**Augmentation toolkit** for freenet-roulette / ruletka WebRTC A/V — not automation.

| Component | Purpose |
|-----------|---------|
| Skill `agentic-engineering` | **Default OS:** vibe → agentic engineering |
| `/agentic` | Preflight + Spec + orchestrate (not thrash) |
| `/spec` | Write DONE WHEN before code |
| Skill `karpathy-method` | Spec → Verifier → Environment detail |
| `/karpathy` | 3 layers + LLM Wiki map |
| Skill `av-fix-loop` | Verify-first director; product frames; one-way; dual-writer rules |
| `/av-verify` | Scorecard v3: verdict + **product** |
| `/smoke-hint` | Human PC+phone smoke checklist |
| `/av-fix` | Enter full fix loop (propose; implement only if asked) |
| `/av-loop` | Measure+route+job cards+**verify-after**; one writer |
| Agent `director` | Parent spawn protocol (no dual thrash) |
| `/knowledge-ingest` | One raw source → wiki (LLM Wiki ingest) |
| `/knowledge-compound` | Scorecard/raw batch → wiki |
| `/knowledge-query` | Answer from wiki first; optional file-back |
| `/knowledge-health` | Lint: rot / contradictions / orphans |
| Agent `diagnose` | Read-only 5-line diagnosis |
| Agent `verify-only` | Re-score after fix/smoke |
| Agent `client-ice` | Web/Android media only (scorecard-gated) |
| Agent `turn-media` | Coturn lock/conf only |
| Personas (project) | `strict-verify`, `no-thrash` in `.grok/personas/` |

**Project hooks (`.grok/hooks/`):** deny unprompted `push.sh`, `iceCandidatePoolSize>0`, git APK-hook install. Requires `/hooks-trust`.  
**Not included:** auto-build APK, auto-deploy thrash.

Director checklist + Claude handoff: `docs/AV_FIX_SUBAGENT_PLAN.md` §8.

## Install (project)

From anywhere:

```bash
grok plugin install /home/drakosik/freenet-roulette/.grok/plugins/ruletka-connect --trust
grok plugin enable ruletka-connect
```

Or point config at the plugins directory:

```toml
# ~/.grok/config.toml or project .grok/config.toml (when supported)
[plugins]
paths = ["/home/drakosik/freenet-roulette/.grok/plugins"]
enabled = ["ruletka-connect"]
```

Reload plugins (`r` in Plugins tab) or start a new session.

## Validate

```bash
grok plugin validate /home/drakosik/freenet-roulette/.grok/plugins/ruletka-connect
```

## Human loop

1. `/smoke-hint` → you Start once both sides  
2. `/av-verify` → agent shows scorecard  
3. You ask to fix → agent uses skill / one role  
4. `/av-verify` again  
5. You say `build apk` / `deploy` only when ready  

Score artifacts: `artifacts/av-verify/latest.{md,json}`.
