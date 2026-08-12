# From vibe coding → agentic engineering (ruletka)

**Vibe coding** (2025): describe the vibe, let the model thrash code, hope it works.  
**Agentic engineering** (Karpathy / 2026): you **orchestrate agents** with specs, verifiers, and an environment that compounds. You are architect + supervisor — not a passenger.

This repo is wired for agentic engineering. Use it on purpose.

---

## Side-by-side

| | Vibe coding | Agentic engineering (here) |
|--|-------------|----------------------------|
| Goal | “Make A/V work” | `knowledge/specs/current-av.md` DONE WHEN |
| Plan | One megaprompt | Agile specs; one hop; job cards |
| Truth | Chat opinion | `av-verify` / tests / product.status |
| Agents | One chat thrashing everything | Director + one writer + verify-after |
| Memory | Scrollback | `knowledge/wiki` + AGENTS + skills |
| Ship | “Should work” | product.ok **or** human smoke |
| Stance | Automate everything | **Augmentation** — human owns ship |

---

## Source videos (Karpathy / Marchese method)

1. [Stop Prompting Claude. Use Karpathy's Method Instead](https://www.youtube.com/watch?v=7zZy1QTvokM) — 3 layers Spec → Verifier → Environment  
   Wiki: `knowledge/wiki/marchese-karpathy-method.md`
2. [Ultimate Guide to Building 10x Faster with Claude](https://www.youtube.com/watch?v=Q-3fgVdmuVw) — 6 steps: stack, domains, **self-improve**, vertical, **skill library**, command center  
   Wiki: `knowledge/wiki/marchese-10x-claude.md`  
   Skills: `/add-new-resource`, `/improve-system`

## The four control surfaces

### 1. Spec (your understanding → machine-usable)

- File: `knowledge/specs/<slug>.md` (template: `_TEMPLATE.md`)
- Or state in chat before non-trivial edits:

```text
GOAL: …                    # real outcome (interview if fuzzy)
DONE WHEN: <measurable>
EVAL: <precise quality criteria>
CHECKPOINTS: <human confirms>
OUT OF SCOPE: …
VERIFY: <command + optional second critic>
LANE: director | client-ice | …
```

- Interview: *“Interview me to identify the goal”* (`/spec`).
- Prefer **small** specs over waterfall dumps.
- Human verifies key decisions — model drafts the spec.

### 2. Verifier (ghosts need feedback loops)

| Kind | Here |
|------|------|
| External signal | `./scripts/av-verify.sh` → `product` + `verdict` |
| Route + cards | `./scripts/av-loop.sh` |
| Second critic | verify-only agent, `check-work`, Claude critic |
| Human | smoke / both faces |

**Rule:** no claim of fixed without a gate that matches DONE WHEN.

### 3. Environment (workshop that improves)

| Piece | Path |
|-------|------|
| Instruction file | `AGENTS.md` (Always / Ask / Never) |
| **Hard walls (hooks)** | `.grok/hooks/` PreToolUse (pool>0, push.sh) — `/hooks-trust` |
| Skills | `.grok/skills/*`, plugin `ruletka-connect` |
| LLM Wiki | `knowledge/` (SCHEMA, raw, wiki, log) |
| Locks | `docs/*_LOCK.md` |
| Personas | `no-thrash`, `strict-verify` |

### 4. Orchestration (you manage agents)

```
Director (you / agent director)
  → measure (av-loop)
  → ONE writer subagent (job card)
  → verify-after (mandatory)
  → human smoke if needed
  → compound wiki
```

Never: parallel writers thrashing the same module without reconcile.

---

## Default workflow (any non-trivial task)

```
1. SPEC     /spec or knowledge/specs/*.md
2. BASELINE measure / tests / read wiki
3. ROUTE    one role, one DONE WHEN
4. IMPLEMENT one writer
5. VERIFY   same gate as DONE WHEN
6. COMPOUND knowledge if evidence solid
```

Connect/A/V specialization: skill **`av-fix-loop`**, slash **`/av-loop`**.  
General method: skill **`agentic-engineering`** / **`karpathy-method`**, slash **`/agentic`**.

---

## Anti-vibe checklist (before you “just fix it”)

- [ ] DONE WHEN written (measurable)
- [ ] Baseline measure exists (or IDLE → smoke)
- [ ] Wiki/gotcha page read if known symptom
- [ ] One implementer lane only
- [ ] Re-measure plan named
- [ ] Ship/APK only if authorized
- [ ] Compound planned if this teaches the next session

Soft automated reminder:

```bash
./scripts/agentic-check.sh
./scripts/agentic-check.sh --connect   # also requires fresh scorecard
./scripts/agentic-loop.sh              # check + av-loop + director next
```

---

## Human role (cannot outsource)

> “You can outsource your thinking, but you can’t outsource your understanding.”

You own: real goal, what “good” means, Always/Never lines, smoke/ship authorization.  
Agents own: bookkeeping, measure, implement under lane, write-back.

---

## Map of tools

| Intent | Command / skill |
|--------|-----------------|
| Enter agentic mode | `/agentic` · skill `agentic-engineering` |
| Write / refine spec | `/spec` |
| Connect loop | `/av-loop` · `av-fix-loop` |
| Score only | `/av-verify` · `./scripts/av-verify.sh` |
| Wiki | `/knowledge-query` · compound · ingest · health |
| 3 layers deep-dive | `/karpathy` · `knowledge/wiki/karpathy-method.md` |

---

## Success looks like

1. Specs live in git, not only chat.  
2. Every fix has before/after scorecard or test.  
3. Subagents get job cards with OWN + DONE WHEN.  
4. Wiki compounds; next week doesn’t re-learn thrash.  
5. Humans still smoke and authorize ship — agents don’t pretend autonomy is quality.
