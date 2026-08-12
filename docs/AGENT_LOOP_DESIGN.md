# Agent loops that complete goals (Grok + Claude)

**Stance:** augmentation. Loops measure, route, and prompt agents — human owns smoke/ship.

**Mode:** **agentic engineering** (not vibe coding) — `docs/AGENTIC_ENGINEERING.md` · `/agentic`.  
**Method:** Spec → Verifier → Environment. Skills `agentic-engineering`, `karpathy-method`.

## Completable loop

```
GOAL (one-line DONE WHEN)          # Layer 1 Spec
  → MEASURE (script → artifacts/)  # Layer 2 Verify
  → ROUTE (table → NEXT_ROLE)
  → PROMPT (job card → Grok subagent and/or Claude)
  → VERIFY (measure again)         # Layer 2
  → SUCCESS | RETRY (hop < MAX) | STUCK (human)
  → COMPOUND wiki when evidence solid  # Layer 3 Environment
```

## Tools in this repo

| Tool | Role |
|------|------|
| `./scripts/av-verify.sh` | Scorecard v3: `verdict` + **`product`** (both-direction frames) |
| `./scripts/av-loop.sh` | Measure + product route + job cards + **verify-after** + director.md |
| `artifacts/av-loop/grok-job.md` | Paste into `spawn_subagent` (ONE writer) |
| `artifacts/av-loop/claude-job.md` | Paste into Claude Code / `claude -p` |
| `artifacts/av-loop/verify-after.md` | **Mandatory** re-score after implementer |
| `artifacts/av-loop/director.md` | Parent spawn protocol |
| Plugin `/av-loop` + agent `director` | Director instructions |
| Agents diagnose / verify-only / client-ice / turn-media / director | Contracts |

## Grok subagents

| NEXT_ROLE | Spawn |
|-----------|--------|
| smoke | No agent — human checklist |
| diagnose | explore or plugin `diagnose`, read-only |
| verify-only | plugin `verify-only` |
| client-ice | general-purpose + `grok-job.md` |
| turn-media | general-purpose + own coturn only |

Always: **one writer**. Optional parallel: RO diagnose only.

## Claude

Claude is a **worker**, not a second director.

```bash
# After av-loop.sh:
claude -p "$(cat artifacts/av-loop/claude-job.md)" --print \
  --allowedTools "Read,Edit,Grep,Glob,Bash" \
  --add-dir "$PWD"
```

Or interactive Claude Code with the same job card pasted.

Then Grok re-runs `./scripts/av-verify.sh` (or `/av-verify`).

Use Claude when PRIMARY FILE is one deep module (e.g. `MediaSession.ts`).  
Use Grok when multi-file, hub, deploy, or routing.

`resume-claude` skill: continue an existing Claude session instead of cold start.

## Waste controls

- Max 2 implementer hops without new smoke  
- Scorecard shared; agents don’t re-SSH the world  
- `GOAL_MET=yes|no|blocked` required in agent output  
- REVERT if scorecard worse  
- No APK/deploy inside loop unless human asked  

## Example (current PC-black goal)

DONE WHEN: `web frames_in >= 10` after smoke.

```bash
./scripts/av-loop.sh --min 10
# NEXT_ROLE=client-ice, claude-job → MediaSession.ts
# Spawn Grok client-ice OR claude -p claude-job.md
./scripts/av-verify.sh --min 10
# human: install APK if mobile changed, smoke, say smoked
./scripts/av-loop.sh --min 10
# after solid diagnosis or PASS:
# /knowledge-compound  → update knowledge/wiki from scorecard
```

## Knowledge base (Layer 3 — Environment / LLM Wiki)

| Path / skill | Role |
|--------------|------|
| `knowledge/SCHEMA.md` | Wiki conventions |
| `knowledge/raw/` | Immutable sources |
| `knowledge/wiki/` | Compiled pages + index + log |
| `knowledge/specs/` | Active DONE WHEN |
| `karpathy-method` | Spec → Verifier → Environment |
| `knowledge-ingest` | One-source ingest |
| `knowledge-compound` | Scorecard/raw batch write-back |
| `knowledge-query` | Query wiki first; file-back answers |
| `knowledge-health` | Lint (contradictions, orphans, stale) |

Compound from scorecards/raw only — not chat folklore.
