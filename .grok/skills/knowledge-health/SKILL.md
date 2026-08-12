---
name: knowledge-health
description: >
  Health check for knowledge/wiki: stale claims, contradictions, missing scorecard
  citations, conflicting force_relay advice. Monthly or when user says knowledge
  health check / wiki health. Slash /knowledge-health.
metadata:
  short-description: "Audit knowledge/wiki for rot and contradictions"
---

# knowledge-health

Audit `knowledge/wiki/` like a monthly CoWork health check. **Report first**; only edit wiki if user says “apply health fixes”.

## Checks (Karpathy Lint)

1. **Stale** — connect claims with no date or older than 30 days vs current code/docs.  
2. **Contradiction** — e.g. one page says same-IP force_relay=false, another true. Flag; resolve only from locks + latest scorecard.  
3. **Orphan** — wiki pages not linked from `wiki/index.md`.  
4. **Missing evidence** — “fixed” language without scorecard/av_path reference.  
5. **Drift from locks** — compare force_relay / pool / SFU claims to `docs/CONNECTIVITY_LOCK.md` and `docs/VIDEO_PATH_LOCK.md`.  
6. **Agent lanes** — OWN/MUST NOT still match `docs/AV_FIX_SUBAGENT_PLAN.md` §8.  
7. **Missing concepts** — terms repeated in raw/ or scorecards but no wiki page.  
8. **Weak cross-links** — related pages should link each other.  
9. **log.md / index.md** — index incomplete or log missing recent compound entries.  
10. After report: append `## [date] lint | HEALTH: …` to `wiki/log.md` if user wants a paper trail (optional).

## Output format

```text
HEALTH: OK | NEEDS_ATTENTION
ISSUES:
- [severity] page: description
SUGGESTED_EDITS:
- page: proposed one-line change (do not apply unless asked)
GAPS:
- topics with no wiki page but frequent in raw/ or av-verify
```

## Never

- Auto-rewrite locks or production code  
- Delete wiki history logs  
- Run unlimited compound inventing new architecture  

## Related

- Method: `karpathy-method` (Layer 3 audit)  
- Write-back: `knowledge-compound`  
- Measure: `./scripts/av-verify.sh`  
