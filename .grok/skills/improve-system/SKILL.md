---
name: improve-system
description: >
  Marchese self-improving loop for freenet-roulette agent system: review skills,
  AGENTS, specs, wiki, gotchas, and work since last run; propose discrete
  improvements for human approve/deny; log so next run does not repeat.
  Use when user says improve-system, /improve-system, self-improving,
  learn from mistakes, system retrospective, or wants the agent OS to get better.
metadata:
  short-description: "Self-improve agent system (approve → apply → log)"
---

# /improve-system — Marchese self-improving loop

**Goal:** the agent OS learns and does not make the same mistake twice.  
**Stance:** **augmentation** — human approves every change. Never auto-ship APK/deploy. Never thrash ICE without scorecard.

Each run is: **review → propose (pending) → wait → implement approved only → log**.

## Paths (repo root)

| Role | Path |
|------|------|
| Last run (delta start) | `knowledge/logs/improve-system/LAST_RUN.md` |
| Append-only run log | `knowledge/logs/improve-system/log.md` |
| Proposals | `knowledge/logs/improve-system/proposals/YYYY-MM-DD-HHMM-slug.md` |
| Scan checklist | `references/CHECKLIST.md` (this skill) |

Create `LAST_RUN.md` / `log.md` / `proposals/` if missing (first run = full baseline scan).

## Hard rules

1. **No silent edits.** Show every proposal; wait for approve/deny before changing files.  
2. **Delta over dump.** Prefer `LAST_RUN` + bounded surfaces (checklist). Cap session samples; no full tool dumps.  
3. **No repeat.** Skip issues already reviewed and denied, or fixed and logged, unless new evidence.  
4. **No production thrash.** Do not change A/V locks, ICE policy, or ship paths unless proposal is high-signal and human-approved.  
5. **Small batch.** Prefer 3–7 proposals per run; more only if clearly independent.

## Procedure

### 1. Load state

1. Read `knowledge/logs/improve-system/LAST_RUN.md` (if any): areas reviewed, denials, `next_focus`.  
2. Tail `knowledge/logs/improve-system/log.md` (last ~40 lines).  
3. Follow **`references/CHECKLIST.md`** — scan only listed surfaces, with caps.

### 2. Review (since last run)

Look for friction that the **system** should absorb:

- Repeated mistakes (same gotcha re-hit, thrash without scorecard, missing VERIFY)  
- Skill / AGENTS / spec gaps vs real work  
- Wiki/index drift; GOTCHAS not reflected in skills  
- Specs without DONE WHEN / EVAL; agent lanes unclear  
- Session patterns (user corrections) — sample **user messages only**, token-capped  

Note **what you reviewed** (file list + short themes) for the log even if you propose nothing.

### 3. Propose — stop for approve/deny

Write one proposal file under `knowledge/logs/improve-system/proposals/`  
name: `YYYY-MM-DD-HHMM-slug.md` (UTC or local, be consistent).

Each item **must** use this block:

```text
### P1: <title>
WHY: (evidence from review)
WHERE: (files/skills)
CHANGE: (concrete)
RISK: low|med|high
APPROVE?: pending
```

Present the same blocks in chat. **Stop.** Ask the human to approve or deny each `P#`. Do not implement yet.

Optional: append a one-line stub to `log.md` that a proposal file was opened (`PROPOSED | path`).

### 4. After human decides

1. Update the proposal file: set each `APPROVE?: approved | denied` (and short note if given).  
2. **Implement only approved** items — minimal, concrete edits.  
3. Do **not** implement denied items; record so next run skips unless new evidence.

### 5. Log outcomes

**Append** to `knowledge/logs/improve-system/log.md`:

```text
## [YYYY-MM-DD HH:MM] improve-system
REVIEWED: <areas / files (bounded)>
PROPOSALS: P1 approved | P2 denied | …
APPLIED: <files changed or none>
NEXT: <next_focus for following run>
```

**Overwrite** `knowledge/logs/improve-system/LAST_RUN.md` with:

```text
# LAST_RUN — improve-system

timestamp: <ISO-8601>
areas_reviewed:
  - …
proposals:
  - id: P1
    title: …
    decision: approved | denied
applied:
  - …
next_focus: …
notes: <optional — denials to remember, open questions>
```

## What good proposals look like

| Good | Bad |
|------|-----|
| “Add scorecard-before-ICE to skill X; evidence: thrash in session Y” | “Rewrite all skills” |
| “GOTCHAS B missing from av-fix preflight one-liner” | Vague “be more careful” |
| “Spec template missing EVAL example for product.status” | Unprompted APK/deploy automation |
| “Wiki index missing link to new gotcha page” | Re-open connectivity locks without scorecard |

## Never

- Auto-apply proposals  
- Auto APK build, `push.sh`, Play upload, or production deploy  
- Dump multi-GB history / full session tool JSON  
- Thrash ICE / force_relay / pool without scorecard + human intent  
- Re-propose the same denied item without new evidence  
- Claim the system “learned” without log + LAST_RUN update  

## Related

- Stance / OS: `AGENTS.md`, `docs/AGENTIC_ENGINEERING.md`  
- Method: `karpathy-method`, `/spec`  
- Connect loop (do not replace): `av-fix-loop`  
- Wiki ops: `/knowledge-compound`, `/knowledge-health`  
- Video map: `knowledge/wiki/marchese-karpathy-method.md`
