---
name: knowledge-ingest
description: >
  Ingest one raw source into the freenet-roulette LLM wiki (Karpathy llm-wiki).
  Drop or write knowledge/raw/, then update wiki pages, index, log. Use when user
  says ingest, file this into wiki, process raw note, or /knowledge-ingest.
metadata:
  short-description: "Ingest one raw source into knowledge/wiki"
---

# knowledge-ingest

Karpathy **Ingest** op: one source at a time when possible. You own wiki bookkeeping; human owns curation.

## Inputs

1. Path or paste for the new source  
2. If paste only: write `knowledge/raw/YYYY-MM-DD-slug.md` first (immutable dump)  
3. Read `knowledge/SCHEMA.md` + `knowledge/wiki/index.md`  

## Steps

1. **Read** the source fully.  
2. **Discuss** (brief): 3–5 key takeaways + which wiki pages touch.  
3. **Update wiki** (may touch multiple pages):
   - Symptom/concept pages: symptoms → gates → cause → lane → MUST NOT → `### Log` line  
   - Mark claims **unverified** if no scorecard  
4. **Update** `knowledge/wiki/index.md` if new page.  
5. **Append** `knowledge/wiki/log.md`:
   `## [YYYY-MM-DD] ingest | <title>`  
6. Report: pages touched + one-line summary.  

## Rules

- Do **not** edit older files under `raw/` (append new files only).  
- Locks win over wiki.  
- Do not thrash production ICE code in an ingest-only turn.  

## Related

- Batch from scorecards: `knowledge-compound`  
- Answer questions: `knowledge-query`  
- Lint: `knowledge-health`  
