# Knowledge base (LLM Wiki)

Karpathy **Environment** layer: compile knowledge once, keep it current.  
Schema: [`SCHEMA.md`](SCHEMA.md) · Method: [`wiki/karpathy-method.md`](wiki/karpathy-method.md)

| Layer | Path | Who |
|-------|------|-----|
| Raw sources | `raw/` | Human + agent dumps (**immutable**) |
| Wiki | `wiki/` | Agents maintain |
| Specs | `specs/` | Active DONE WHEN goals |
| Schema | `SCHEMA.md` + root `AGENTS.md` | Conventions |

## Operations

| Op | Slash / skill | Purpose |
|----|---------------|---------|
| Ingest | `/knowledge-ingest` | One raw source → wiki |
| Compound | `/knowledge-compound` | Scorecards + raw batch → wiki |
| Query | `/knowledge-query` | Answer from wiki; optional file-back |
| Lint | `/knowledge-health` | Contradictions, orphans, stale claims |

Also: `/karpathy` for Spec → Verifier → Environment.

## Rules

- Wiki connect claims should cite scorecard `at` or av_path when possible.  
- Prefer `./scripts/av-verify.sh` over inventing gates.  
- Locks win: `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md`.  
- Augmentation: human owns smoke / APK / deploy.  
