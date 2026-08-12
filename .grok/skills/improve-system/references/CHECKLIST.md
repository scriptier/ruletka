# improve-system — scan checklist

Bounded surfaces only. Prefer **delta since** `knowledge/logs/improve-system/LAST_RUN.md`.  
Never dump full history, full session tool traces, or large binary/artifact trees.

## Always (every run)

Read or skim in this order when present:

| # | Surface | How |
|---|---------|-----|
| 1 | `knowledge/logs/improve-system/LAST_RUN.md` | Full — start of delta; honor denials + `next_focus` |
| 2 | `knowledge/logs/improve-system/log.md` | Last ~40 lines |
| 3 | Recent proposals in `knowledge/logs/improve-system/proposals/` | Filenames + open `APPROVE?: pending` only if still open |
| 4 | `AGENTS.md` | Full or sections changed since last run |
| 5 | `docs/AGENTIC_ENGINEERING.md` | Skim headings + any new “hard walls” / ship rules |
| 6 | Project skills `.grok/skills/*/SKILL.md` | List dirs; re-read skills tied to recent pain or `next_focus` |
| 7 | `knowledge/SCHEMA.md` | Skim structure / write rules |
| 8 | `knowledge/wiki/index.md` | Full index (short) |
| 9 | `knowledge/wiki/log.md` | **Last 30 lines only** |
| 10 | Active specs `knowledge/specs/current-*.md` | Full each current-* |
| 11 | `.grok/skills/av-fix-loop/references/GOTCHAS.md` | Full — thrash / product FAIL patterns |

## Optional (when useful)

| Surface | Cap |
|---------|-----|
| `git log --oneline -20` | 20 commits |
| `knowledge/raw/*` recent files | Newest 3–5 files; skim titles + first headings |
| `knowledge/specs/` non-current | Only if work referenced them or `next_focus` says so |
| `knowledge/wiki/*.md` beyond index | Only pages linked from recent log / GOTCHAS / user pain |
| `artifacts/av-loop/PRODUCT`, `NEXT_ROLE`, `director.md` | Skim if A/V thrash is in scope this run |
| `artifacts/av-verify/latest.md` | Verdict + product line only (not full HISTORY.jsonl) |
| Session under `~/.grok/sessions` (if path known) | **User messages only**; sample last session(s) since LAST_RUN; **hard cap** (~2–4k tokens). Prefer LAST_RUN delta over re-reading whole sessions |
| User skill mirrors / global agentic skills | Only if project AGENTS points at drift |

## Skip / never scan as bulk

- `mobile/node_modules/`, `node_modules/`, `target/`, large `mobile/artifacts/**` APK trees  
- Full `artifacts/av-verify/HISTORY.jsonl` (use latest + optional last few stamps)  
- Full session tool dumps, screenshots binaries, Play bundles  
- Re-reading every wiki page every run  

## Review lenses (what to look for)

While scanning, tag findings (for proposals):

1. **Repeat mistake** — same class of error after a prior fix or GOTCHA  
2. **Missing gate** — work without Spec / EVAL / verify-after  
3. **Skill gap** — agent did X poorly; skill should encode the rule  
4. **Doc drift** — AGENTS vs skill vs lock vs wiki disagree  
5. **Weak memory** — outcome not compounded to wiki/log  
6. **Process thrash** — multi-writer, no scorecard, unprompted ship  
7. **UX of agents** — unclear OWN/MUST NOT, vague DONE WHEN  

## Output discipline

- Record **areas reviewed** (checklist #s + key files) even if zero proposals.  
- Do not re-propose items listed as **denied** in LAST_RUN without **new evidence**.  
- Prefer proposals that harden the **system** (skills, AGENTS, checklist, specs, wiki) over one-off code thrash.
