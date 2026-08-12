# Video: Stop Prompting Claude — Use Karpathy’s Method (Marchese)

Source: [YouTube `7zZy1QTvokM`](https://www.youtube.com/watch?v=7zZy1QTvokM) — Austin Marchese  
Theme: almost everyone prompts agents wrong; use **3 layers** so work compounds.

## Core claim

Don’t treat the model like a **vending machine** (one prompt → finished product).  
Build a **system**: Spec → Verifier → Environment. Human supplies **understanding**; model supplies computation.

Famous gap: “car wash 50m away — walk or drive?” Models say walk (distance) and miss “you need the car there.” **Context/judgment needs your signal.**

## Layer 1 — Spec (detailed, collaborative)

| Principle (video) | Practice | In this repo |
|-------------------|----------|--------------|
| Uncover the **real goal** (not the task) | “Interview me to identify the goal” | Skill **`spec`** / `/spec` |
| **Agile**, not waterfall | Small compartmentalized specs | One hop; `MAX HOPS`; job cards |
| Be precise; human verifies key decisions | “Make me verify key decisions explicitly” | Spec `CHECKPOINTS:` + human ask-first |

## Layer 2 — Verifier (ghosts, not animals)

Yelling at the model doesn’t help. Use **feedback loops**.

| Practice | Video | Here |
|----------|-------|------|
| Criteria up front | “Outline evaluation criteria…” | Spec `EVAL:` + `DONE WHEN` |
| Second model as critic | Different “library” grades the work | `check-work`, Claude critic, verify-only |
| External signal | Ground truth from systems | `av-verify` / `product.status` / tests / smoke |

Boris Cherny (Claude Code): feedback loop → **2–3× quality**.

## Layer 3 — Environment (workshop that compounds)

| Practice | Here |
|----------|------|
| AGENTS.md every session | Root `AGENTS.md` |
| LLM knowledge base | `knowledge/` (raw → wiki → query → lint) |
| Skills for repeated work | `.grok/skills/*`, plugin `ruletka-connect` |
| Hard rules (Always / Ask / Never) | AGENTS + scripts (walls > vibes) |

> “You can outsource your thinking, but you can’t outsource your understanding.”

## Gap map (after this video analysis)

| Video ask | Status before | Action now |
|-----------|---------------|------------|
| Interview for goal | Partial in `/spec` | **Strengthened** interview protocol |
| Explicit eval criteria in spec | DONE WHEN only | **EVAL + CHECKPOINTS** in template/skill |
| Second critic default for complex | Optional | Director: verify-after + second critic when multi-file |
| Tool-level Never walls | Soft AGENTS only | **Done:** `.grok/hooks/never-rules.json` + `pretool-never.sh` (trust with `/hooks-trust`) |
| Cite this source | Missing | This page + index |

## Related

- [agentic-engineering](agentic-engineering.md) · [karpathy-method](karpathy-method.md)  
- Follow-on video (skill library + self-improve): [marchese-10x-claude](marchese-10x-claude.md)  
- Playbook: `docs/AGENTIC_ENGINEERING.md`  
- Spec template: `knowledge/specs/_TEMPLATE.md`

### Log

- 2026-08-10: Ingested Marchese video analysis; wired gaps into `/spec`, AGENTS, agentic-check.
- 2026-08-10: Linked 10× Claude video (`Q-3fgVdmuVw`) + `/improve-system` / `/add-new-resource`.
