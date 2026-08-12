# Knowledge schema (LLM Wiki — Karpathy pattern)

Agents maintain this knowledge base. Humans curate sources and ask questions.  
Canonical idea: **compile once, keep current** — do not re-RAG thrash from chat folklore.

## Three layers

| Layer | Path | Who writes | Mutability |
|-------|------|------------|------------|
| **Raw sources** | `knowledge/raw/` | Human or agent dump | **Immutable after write** — never edit old dumps; add new dated files |
| **Wiki** | `knowledge/wiki/` | **LLM only** (compound/ingest/query file-back) | Agents own; humans may veto |
| **Schema** | this file + `AGENTS.md` | Human + agent co-evolve | Change when ops need clarity |

Locks (`docs/*_LOCK.md`) **outrank** wiki when they conflict. Wiki must note the conflict, not silently override locks.

## Page types (wiki)

| Type | Examples | Must include |
|------|----------|--------------|
| **Method** | `karpathy-method.md` | How agents work here |
| **Concept** | `force-relay-same-lan.md`, `gotchas.md` | Rules + MUST NOT + evidence dates |
| **Symptom** | `one-way-video.md` | Gates, ranked causes, lane, log |
| **Tool** | `connect-scorecard.md`, `agent-lanes.md` | Commands + DONE WHEN |
| **Spec** | `../specs/*.md` | GOAL + DONE WHEN + OUT OF SCOPE (active goals) |
| **Query artifact** | optional `wiki/q-*.md` | Filed answers that should compound |

## Conventions

1. **index.md** — content catalog; one line per page; update on every ingest/compound.  
2. **log.md** — append-only chronology. Prefer entries:
   ```text
   ## [YYYY-MM-DD] ingest | short title
   ## [YYYY-MM-DD] compound | short title
   ## [YYYY-MM-DD] query | short title
   ## [YYYY-MM-DD] lint | HEALTH: OK|NEEDS_ATTENTION
   ```
3. Connect claims **cite** scorecard `at=` or av_path fields when possible.  
4. Prefer short pages + links over duplicating `docs/` plans.  
5. Unverified fixes: mark **unverified** until scorecard/human smoke.  
6. Append `### Log` on symptom/concept pages rather than erasing history.

## Operations

| Op | Skill / slash | When |
|----|---------------|------|
| **Resource funnel** | `add-new-resource` / `/add-new-resource` | Any new URL/shot/note → raw + wiki card (always first) |
| **Ingest** | `knowledge-ingest` / `/knowledge-ingest` | Deep one-source → multi-page wiki |
| **Compound** | `knowledge-compound` / `/knowledge-compound` | After PASS/STUCK/scorecard batch |
| **Query** | `knowledge-query` / `/knowledge-query` | Answer from wiki first; optional file-back |
| **Lint** | `knowledge-health` / `/knowledge-health` | Monthly or when wiki feels wrong |
| **Self-improve** | `improve-system` / `/improve-system` | Review agent OS; propose; human approve/deny; log |

## Read order (hard problems)

1. Active spec in `knowledge/specs/` if any  
2. `wiki/index.md`  
3. Relevant wiki pages  
4. Locks  
5. Measure (`av-verify`)  
6. Code  

## Never

- Edit `raw/` history in place  
- Claim PASS without scorecard or human faces  
- Compound chat theories that contradict locks  
- Thrash ICE “while documenting”  
