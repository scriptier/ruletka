---
name: knowledge-compound
description: >
  Ingest raw notes and av-verify scorecards into knowledge/wiki for freenet-roulette.
  Self-improving knowledge base write-back (Karpathy-style). Use when user says
  compound knowledge, update wiki, save this smoke into wiki, or after A/V PASS/STUCK
  from /av-loop. Slash /knowledge-compound.
metadata:
  short-description: "Write scorecards/smokes into knowledge/wiki"
---

# knowledge-compound

You maintain a **self-improving wiki** under `knowledge/` — **Layer 3 (Environment)** of the Karpathy method (`karpathy-method`). You do **not** thrash ICE or ship APKs.

## Inputs (read)

1. `knowledge/raw/*` — newest first  
2. `artifacts/av-verify/latest.json` + `latest.md` if present  
3. `artifacts/av-loop/latest.json` if present  
4. Existing `knowledge/wiki/*.md`  
5. Active `knowledge/specs/*` status notes when product goal open  

Also compound after **implementer hops** that produced a solid root-cause (even if smoke pending) — mark **unverified** until frames/smoke.

**Thrash trigger:** if session ships **≥3 APKs** or is stuck **>1 day** on the same DONE WHEN, compound (raw + wiki gotcha) **before** the next implementer hop.

## Rules

- **Prefer evidence over chat.** Cite scorecard `at` timestamps and av_path fin/fout when updating connect pages.  
- **Do not invent** force_relay or coturn facts that contradict locks (`docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md`).  
- **Append** to `### Log` sections with `YYYY-MM-DD:` rather than rewriting history away.  
- Keep pages short; link instead of duplicating full plan docs.  
- Augmentation: if unsure whether a fix worked, write “unverified” — don’t claim PASS without scorecard.  

## Steps

1. List new/changed files in `knowledge/raw/` (last 14 days) and latest scorecard.  
2. Read `knowledge/SCHEMA.md` + `wiki/index.md`.  
3. Decide which wiki pages to update (`index.md` if new page).  
4. Update pages:
   - Symptoms → gates → root cause → lane → MUST NOT → `### Log` line  
5. **Append** `knowledge/wiki/log.md`: `## [YYYY-MM-DD] compound | <title>`  
6. Optionally write `knowledge/logs/YYYY-MM-DD-compound.md` one-paragraph digest.  
7. Report to human: pages touched + one-line summary.  

## Never

- Edit production code unless user also asked for a fix in the same turn  
- Delete raw dumps  
- “Health check” rewrite of all wiki from imagination  

## Related

- Method: skill `karpathy-method`, `knowledge/wiki/karpathy-method.md`  
- Health pass: skill `knowledge-health`  
- Connect loop: `av-fix-loop`, `./scripts/av-loop.sh`  
- Design: `knowledge/README.md`, pattern: raw → wiki → Q&A → write-back → health  
