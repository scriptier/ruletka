---
name: agentic-engineering
description: >
  Project agentic engineering for freenet-roulette: Spec → Verifier → Environment,
  not vibe coding. Use when user says agentic, vibe, /agentic, multi-step work,
  or needs the operating system for agents. Maps to av-loop, wiki, specs.
metadata:
  short-description: "Agentic engineering OS (ruletka)"
---

# Agentic engineering (this repo)

1. Follow user skill **agentic-engineering** (global protocol).  
2. Read **`docs/AGENTIC_ENGINEERING.md`** (full map).  
3. Preflight: `./scripts/agentic-check.sh` (add `--connect` for A/V).  
4. Before multi-step work: list active `knowledge/specs/current-*.md` and read any that apply.

| Step | Here |
|------|------|
| Spec | `knowledge/specs/` · `/spec` · EVAL + CHECKPOINTS (Marchese); list `current-*.md` first |
| Baseline | `./scripts/av-loop.sh` or av-verify |
| Route | `artifacts/av-loop/NEXT_ROLE` + director.md |
| One writer | grok-job **or** claude-job (never both same OWN) |
| **UX default** | **one implementer** OWN files + optional **verify-only**/check-work — multi-agent only when human lists ≥2 independent FAIL lines with non-overlapping OWN |
| **Claude worker** | skill **`claude-worker`** · `./scripts/agents/dispatch.sh --wait` · queue `tasks/admin-queue/pending/` |
| Verify-after | `verify-after.md` / av-verify — **mandatory** |
| Second critic | verify-only + check-work **and/or Claude** on multi-file |
| Compound | `/knowledge-compound` (also: ≥3 APKs in session or multi-day stuck same DONE WHEN → compound before next hop) |
| Resource funnel | `/add-new-resource` (raw + wiki card) |
| Self-improve OS | `/improve-system` (propose → approve → log) |

Video map: `knowledge/wiki/marchese-karpathy-method.md` · 10× skill library: `marchese-10x-claude.md`.  
Connect: **av-fix-loop**. Method: **karpathy-method**. Stance: **augmentation**.
