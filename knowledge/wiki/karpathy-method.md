# Karpathy method (both videos → this repo)

**Umbrella:** agentic engineering (not vibe coding) — skill `agentic-engineering`, `docs/AGENTIC_ENGINEERING.md`.

Two complementary patterns. Use **both**.

| Video / source | Pattern | Our implementation |
|----------------|---------|---------------------|
| **3 layers** (coding agents) | Spec → Verifier → Environment | Skill `karpathy-method`, `AGENTS.md`, av-verify, skills |
| **LLM Wiki** (CoWork / gist) | raw → wiki → query → lint; compounding pages | `knowledge/` + SCHEMA + ingest/compound/query/health |
| **Agentic engineering** (post–vibe coding) | Orchestrate agents under human oversight | `/agentic`, director, job cards, verify-after |

## Layer 1 — Spec

- Active product goal: [`../specs/current-av.md`](../specs/current-av.md)
- Job cards from `./scripts/av-loop.sh`
- Agile: one DONE WHEN per hop; interview human if goal fuzzy
- Prefer measurable outcomes (`frames_in ≥ 10`) over vibes

## Layer 2 — Verifier

| Practice | Here |
|----------|------|
| Criteria up front | DONE WHEN in spec / job card |
| External signal | `./scripts/av-verify.sh`, coturn lock, HISTORY |
| Second critic | `check-work`, verify-only agent, or Claude on same job card |
| Loop | measure → change → re-measure; worse → stop/revert |

Do not treat the model like an animal (yelling). Treat it like a ghost: **verification** is the lever.

## Layer 3 — Environment (workshop)

| Piece | Path |
|-------|------|
| Instruction file | `AGENTS.md` (Always / Ask / Never) |
| Wiki schema | `knowledge/SCHEMA.md` |
| Compiled knowledge | `knowledge/wiki/` |
| Immutable sources | `knowledge/raw/` |
| Skills | av-fix-loop, knowledge-*, karpathy-method |
| Hard gates | locks + av-verify scripts |

### LLM Wiki operations

| Op | Skill |
|----|--------|
| Ingest | `knowledge-ingest` |
| Compound | `knowledge-compound` |
| Query | `knowledge-query` |
| Lint | `knowledge-health` |

Chronology: [log.md](log.md) · Catalog: [index.md](index.md)

## Full connect loop

```
Spec (current-av / DONE WHEN)
  → av-verify / av-loop (Verifier)
  → read wiki + locks (Environment)
  → one role / one change
  → re-verify + optional second critic
  → human smoke if APK
  → compound + log (Environment write-back)
```

### Log

- 2026-08-10: Scaffolded 3-layer method into Grok.
- 2026-08-10: Full LLM Wiki ops (SCHEMA, log, ingest/query, Always/Ask/Never, current-av spec).
