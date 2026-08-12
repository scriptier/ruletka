---
name: knowledge-query
description: >
  Answer questions from freenet-roulette knowledge/wiki first (Karpathy Query op).
  Cite wiki pages; optionally file the answer back as a wiki page. Use when user
  asks about connect history, force_relay rules, gotchas, or /knowledge-query.
metadata:
  short-description: "Query wiki first; optional file-back"
---

# knowledge-query

Karpathy **Query** op: search **compiled wiki**, not re-derive from chat.

## Steps

1. Read `knowledge/wiki/index.md`.  
2. Open 1–5 relevant pages (and active `knowledge/specs/*` if on-goal).  
3. Answer with **citations** to wiki paths (and scorecard dates if present).  
4. If the answer is reusable synthesis (comparison, decision table, new gotcha):
   - Offer to **file back** as `knowledge/wiki/<slug>.md` or append to existing page  
   - On file-back: update index + append log `## [date] query | title`  
5. If wiki lacks the answer: say **gap**, suggest raw dump or av-verify measure — do not invent.

## Rules

- Prefer wiki over free recall for connect/ICE.  
- If locks contradict wiki, prefer locks and flag wiki for lint.  
- No ICE code edits in a pure query turn unless user also asked for a fix.  

## Related

- Write-back batch: `knowledge-compound`  
- Lint: `knowledge-health`  
- Method: `karpathy-method`  
