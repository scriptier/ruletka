---
name: karpathy-method
description: >
  Karpathy 3-layer method for freenet-roulette: Spec → Verifier → Environment
  plus full LLM Wiki ops (ingest/compound/query/lint). Use when user says
  karpathy, 3-layer, wiki ops, or /karpathy-method /karpathy.
metadata:
  short-description: "Spec → Verifier → Environment + LLM Wiki"
---

# Karpathy method (project)

1. Follow user skill **karpathy-method** (Spec → Verifier → Environment).  
2. Read **`knowledge/wiki/karpathy-method.md`** and **`knowledge/SCHEMA.md`**.  
3. Active A/V goal: **`knowledge/specs/current-av.md`**.

| Layer | Here |
|-------|------|
| Spec | DONE WHEN; `knowledge/specs/*`; av-loop job cards |
| Verifier | `./scripts/av-verify.sh`; second critic optional |
| Environment | AGENTS Always/Ask/Never; wiki; skills |

Wiki ops: `/knowledge-ingest` · `/knowledge-compound` · `/knowledge-query` · `/knowledge-health`.  
Connect director: **av-fix-loop**. Stance: augmentation.
