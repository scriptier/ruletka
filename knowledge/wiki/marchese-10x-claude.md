# Video: Ultimate Guide to Building 10x Faster with Claude (Marchese)

Source: [YouTube `Q-3fgVdmuVw`](https://www.youtube.com/watch?v=Q-3fgVdmuVw) — Austin Marchese  
Raw dump: [`../raw/2026-08-10-marchese-10x-claude.md`](../raw/2026-08-10-marchese-10x-claude.md)  
Companion (3 layers): [marchese-karpathy-method](marchese-karpathy-method.md)

## Core claim

Don’t only chat. Build a **T-shaped system**: broad top (stack + domains + self-improve) and **depth in one vertical** (skill library + command center). Context leaks if you never file work — “bucket with a hole.”

## Six steps → this repo

| Step | Video | Ruletka / freenet-roulette |
|------|--------|----------------------------|
| 1. Lock AI stack | One primary agent stack | Grok Build + optional Claude workers; locks in AGENTS |
| 2. Expand domains of execution | Tools, subagents, parallel | Subagents, av-loop roles, hub-match-speed, APK scripts |
| 3. Self-improving system | Review history → improve | **`/improve-system`** + wiki compound + GOTCHAS |
| 4. Identify vertical | Niche focus | **Same-WiFi A/V + mobile UX + linking speed** (not SFU) |
| 5. Skill library | Skills from real work | `.grok/skills/*` — only from thrash we already paid for |
| 6. Niche command center | Always-on OS | **`AGENTS.md` + `knowledge/` + active specs** |

## Skills born from this video + user screenshots

| Skill | Role |
|-------|------|
| **`/add-new-resource`** | Every new URL/shot/note → `raw/` untouched + wiki summary |
| **`/improve-system`** | Review system + delta since last run → proposals → approve/deny → log |

Deeper wiki ops remain: `/knowledge-ingest`, `/knowledge-compound`, `/knowledge-query`, `/knowledge-health`.

## Practical constraints (from community practice)

- Do **not** feed multi-GB session dumps; sample user messages / scorecards / LAST_RUN deltas.  
- Self-improve **proposes**; human **approves** (augmentation stance).  
- Skills from **repeated work**, not vanity prompts.

## Gap map (after incorporating this video)

| Video ask | Status | Action |
|-----------|--------|--------|
| Uniform resource funnel | Was only knowledge-ingest | **Done:** `/add-new-resource` |
| Self-improve loop with approve | Partial (compound/gotchas) | **Done:** `/improve-system` + logs |
| Skill library from thrash | Strong (av-fix, wiki) | Continue: only skillize after 2+ hits |
| Niche command center | AGENTS + wiki | Keep active specs + index current |
| Bound history | Soft | improve-system CHECKLIST caps |

## Related

- [resources](resources.md) · [agentic-engineering](agentic-engineering.md) · [karpathy-method](karpathy-method.md)  
- Skills: `.grok/skills/improve-system/`, `.grok/skills/add-new-resource/`

### Log

- 2026-08-10: page created from Q-3fgVdmuVw + skill screenshots.
