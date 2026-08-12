# AGENTS.md — Grok Build (ruletka)

## Default mode: **agentic engineering** (not vibe coding)

You **orchestrate** work with Spec → Verifier → Environment. You do **not** thrash code from vibes.

| Vibe | Agentic (required for non-trivial work) |
|------|----------------------------------------|
| “Just fix A/V” | DONE WHEN in `knowledge/specs/` or chat |
| Hope | `av-verify` / `product.status` / tests |
| Endless chat thrash | One hop, one writer, verify-after |
| Amnesia | Wiki compound + this file |

**Playbook:** `docs/AGENTIC_ENGINEERING.md` · skill **`agentic-engineering`** · slash **`/agentic`**  
**Spec tool:** skill **`spec`** · slash **`/spec`**  
**Preflight:** `./scripts/agentic-check.sh` (`--connect` for A/V)  
**One-shot entry:** `./scripts/agentic-loop.sh` (check + av-loop + director hints)  
**Claude workers:** skill **`claude-worker`** · factory `docs/AGENT_GROK_CLAUDE.md` · `CLAUDE-WORKFLOW.md`

---

## Dual agents: Grok (director) + Claude (worker)

| Role | Owns | Launch |
|------|------|--------|
| **Grok** | Spec, route, hub/TURN, deploy, APK, merge, Pixel adb smoke, wiki compound | This session / `spawn_subagent` |
| **Claude** | Scoped implement/review in git worktree; unit tests; UI polish; second critic | `./scripts/agents/dispatch.sh --wait tasks/…` or continuous factory |

**Hard rule — one writer per file set.** Never Grok + Claude thrashing `MediaSession.ts` / same live hop in parallel.  
Claude is a **subagent worker**, not a second director.

### When to fire Claude (default)

| Situation | Claude job |
|-----------|------------|
| Multi-file ship / overnight hop | **Second critic** (read-only RESULT) |
| Pure unit/test/i18n/docs polish | **Implement** via `tasks/admin-queue/pending/*.md` |
| A/V deep single module | `artifacts/av-loop/claude-job.md` **or** Grok — not both |
| User says “use Claude” / “fire Claude” | Enqueue 1–3 tasks + `dispatch.sh --wait` or rely on continuous |

### Commands (repo root)

```bash
./scripts/agents/status.sh
# write task → tasks/admin-queue/pending/NNN-slug.md
./scripts/agents/dispatch.sh --wait tasks/admin-queue/pending/NNN-slug.md
./scripts/agents/loop.sh 3          # drain up to 3
./scripts/agents/harvest.sh         # worktree → main after COMPLETE
# continuous shift (keeps Claude busy when pending exists):
./scripts/agents/start-sleep-shift.sh
```

Claude CLI: `/home/drakosik/.local/bin/claude` (`claude -p` non-interactive).  
Worktree: `$HOME/freenet-roulette-claude`. Harvest only allowed paths (see `scripts/agents/lib.sh`).

---

## Stance: **augmentation**, not automation

Agents **augment** the human: measure, diagnose, propose, implement when asked, verify with tools.  
Agents **do not** auto-ship APKs, auto-deploy prod, or thrash ICE policy without a scorecard and human direction.

Human owns: real goal, Start/Stop smoke, install APK, authorize deploy, final “ship it”.  
You own: Spec clarity, honest verifiers, compounding environment, disciplined orchestration.

---

## Always / Ask first / Never

| Bucket | Examples |
|--------|----------|
| **Always** | Spec for multi-step; before multi-step work list active `knowledge/specs/current-*.md`; measure before ICE/TURN claims; **UX default: one implementer + optional verify-only** (multi-agent only when human lists ≥2 independent FAIL lines with non-overlapping OWN); pool=0; read wiki+locks on hard bugs; verify-after edits; compound after solid evidence; when human drops bug screenshots run `/add-new-resource` before coding; after version bump update `knowledge/specs/SMOKE-NEXT.md` install APK line (version string only) |
| **Ask first** | Production `push.sh`; Play upload; bulk APK to site download; hub force_relay policy flip; changing locks |
| **Never** | Claim “fixed” without scorecard/human faces; `iceCandidatePoolSize` > 0; dual-offer thrash; parallel ICE rewriters; SFU as default; invent wiki facts that contradict locks; ship on vibe; **APK flood** — after one successful `npm run verify` + one `build-apk-local --bump` in a session, **stop** until human smoke paste or explicit FAIL lines (second bump needs FAIL ticket text in chat) |

Prefer tool-level checks (`av-verify` exit codes, `product.status`) over hope.

### Hard walls (hooks — Marchese Layer 3)

Project hooks in `.grok/hooks/` **deny** (when folder trusted via `/hooks-trust`):

- `scripts/deploy/push.sh` from agent shells  
- `iceCandidatePoolSize` set to anything but 0  
- Unprompted `install-apk-hook` / git-hooks install  

See `.grok/hooks/README.md`. AGENTS “Never” is a request; hooks are a wall.

---

## Method: Spec → Verifier → Environment

Skills: **`agentic-engineering`**, **`karpathy-method`**, **`spec`**.  
Video map: `knowledge/wiki/marchese-karpathy-method.md` (Marchese / Karpathy 3 layers).  
Wiki: `knowledge/wiki/karpathy-method.md` · playbook: `docs/AGENTIC_ENGINEERING.md`.

| Layer | Question | Here |
|-------|----------|------|
| **1. Spec** | Real goal + DONE WHEN + **EVAL** | `knowledge/specs/*` · `/spec` · job cards |
| **2. Verifier** | How do we know? | Criteria up front; `av-verify` **product**; verify-after; **second critic** on complex |
| **3. Environment** | What should next agent know? | This file + skills + locks + wiki |

```
Interview (if fuzzy) → SPEC (small) → measure → one change → re-measure
  → second critic if multi-file → compound
```

### Spec principles (Marchese / Karpathy)

1. **Goal ≠ task** — interview when fuzzy (`/spec`).  
2. **Agile** — small compartmentalized specs; not one waterfall megaprompt.  
3. **Human checkpoints** — model drafts; human confirms key decisions.  
4. **EVAL up front** — precise criteria in the spec, not “looks good”.

### Verifier principles

1. Criteria before code.  
2. External signal (`av-verify` / tests / smoke) over hope.  
3. Second critic on complex builds: `check-work` and/or verify-only / Claude.  
4. Models are **ghosts** not animals — feedback loops, not yelling.

Skip full Spec only for trivial one-liners. Never skip Verifier on connect/A/V.

---

## Knowledge base (LLM Wiki — Environment)

Schema: **`knowledge/SCHEMA.md`**. Ops:

| Op | Skill / slash |
|----|----------------|
| **New resource funnel** (raw + wiki card) | `add-new-resource` / `/add-new-resource` |
| Ingest one source (deep) | `knowledge-ingest` / `/knowledge-ingest` |
| Compound scorecards | `knowledge-compound` / `/knowledge-compound` |
| Query wiki first | `knowledge-query` / `/knowledge-query` |
| Lint / health | `knowledge-health` / `/knowledge-health` |
| **Self-improve agent OS** | `improve-system` / `/improve-system` |

After multi-day thrash or weekly: `/improve-system`.

**Thrash compound gate:** if a session ships **≥3 APKs** or is stuck **>1 day** on the same DONE WHEN, run `/knowledge-compound` (raw + wiki gotcha) **before** the next implementer hop.

| Path | Role |
|------|------|
| `knowledge/raw/` | Immutable dumps |
| `knowledge/wiki/` | LLM pages + index + log |
| `knowledge/specs/` | Active DONE WHEN specs |

---

## Connect / A/V (specialization)

- Locks: `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md`
- Active product spec: `knowledge/specs/current-av.md`
- Skill: **`av-fix-loop`** · plugin **`ruletka-connect`**
- Loop: `./scripts/av-loop.sh` → one writer → **verify-after** → smoke → compound
- Director agent: `director` · plan: `docs/AV_FIX_SUBAGENT_PLAN.md` · design: `docs/AGENT_LOOP_DESIGN.md`

### Gotchas (do not burn multi-day thrash again)

1. **Score first** — `av-verify` / `av-loop`; read **`product`** not only verdict.  
2. **One fix per loop** — one role; one writer.  
3. **SDP ≠ media** — need frames / product.ok / human faces.  
4. **pool=0** forever.  
5. **VERIFY before APK**; after APK → smoke before GOAL_MET.  
6. Full list: `.grok/skills/av-fix-loop/references/GOTCHAS.md`

---

## Mobile APK (on request)

Do **not** auto-build after every `mobile/` change.

When human says **build apk** / **bump apk** / authorized proceed on a mobile fix:

```bash
cd /home/drakosik/freenet-roulette/mobile
./scripts/build-apk-local.sh --bump
```

Report artifact path. On success the script also **adb-pushes** a copy to the phone  
`Download/` folder (prefers **Pixel 9 Pro** when online). Use `--no-push` to skip.  
Detail: `docs/MOBILE_BUILD.md`.

**Smoke gate (no APK flood):** one successful verify + one `--bump` per session → **stop** for human smoke paste or explicit FAIL lines. A second bump requires FAIL ticket text in chat.  
**SMOKE-NEXT lockstep:** after a version bump, update the install APK version string in `knowledge/specs/SMOKE-NEXT.md` only (do not rewrite DONE WHEN).

### Never without explicit human authorization

- Production deploy / `scripts/deploy/push.sh`
- Play Console upload  
- (Site download APK only when smoke ship clearly authorized)

---

## Default response shape

### Non-trivial / multi-step

1. **Spec** — DONE WHEN (or `/spec`); list active `knowledge/specs/current-*.md` first.  
2. **Preflight** — `agentic-check` when useful.  
3. **Measure** — baseline.  
4. **State** — evidence in plain language.  
5. **Propose** — one next role.  
6. **Act** — when asked / authorized.  
7. **Re-measure** — verify-after.  
8. **Compound** — wiki when solid.  
9. **Build/deploy** — only if asked.

### Connect shortcut

`/av-loop` or `./scripts/av-loop.sh` then follow `artifacts/av-loop/director.md`.
