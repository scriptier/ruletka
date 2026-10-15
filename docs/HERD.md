# Herd shepherd (multi-agent control room)

**Herd** is freenet-roulette’s **product-brain glue** for parallel agents: run folders, lane status, OWN path locks, and job cards. It is **not** a terminal multiplexer.

**Default still holds:** one implementer + optional verify-only. Multi-agent only when the human lists **≥2 independent FAIL lines** with **non-overlapping OWN**.

---

## Herdr vs herd scripts

| Layer | What | Required? |
|-------|------|-----------|
| **[Herdr](https://herdr.dev/)** | Optional **external** agent runtime / terminal multiplexer (real PTY panes, detach, sidebar working/blocked/idle). | **Installed on this desktop** (0.8.0) — also binds `personal-os` + `shopops`; see `docs/HERD_HERDR.md` |
| **`scripts/herd/`** | Our **shepherd**: run state under `artifacts/herd/`, OWN locks, lane cards, status/wait. | Yes for multi-lane orchestration |

Herdr keeps Claude (or other CLIs) alive overnight in panes. Our herd scripts answer: *who owns which path, what is the DONE WHEN, and is the run settled?* They complement each other; herd works without Herdr.

Optional install (human choice only; **do not** assume it is present):

```bash
curl -fsSL https://herdr.dev/install.sh | sh
# then: herdr
```

Upstream: [herdr.dev](https://herdr.dev/) · [github.com/herdrdev/herdr](https://github.com/herdrdev/herdr). Treat license as **AGPL / open-source with obligations** — verify `LICENSE` on install. **Not required** for freenet-roulette agent work.

---

## Layout: `artifacts/herd/<run>/`

```text
artifacts/herd/
  CURRENT                 # symlink → active run_id
  <run_id>/
    run.json              # { run_id, created_at, goal, status }
    lanes/<lane_id>.json  # status machine + own + goal_met
    lanes/<lane_id>.md    # job card (spawn_subagent paste)
    locks/<path>.lock     # OWN exclusive locks (sanitized path: / → __)
```

| Artifact | Role |
|----------|------|
| `run.json` | Run metadata and open/closed status |
| `lanes/*.json` | Machine-readable lane state |
| `lanes/*.md` | Human/agent job card with REPORT block |
| `locks/*.lock` | One writer per path: `{"lane","path","at"}` |

---

## Commands

All from repo root. Prefer `artifacts/herd/CURRENT`.

| Command | Purpose |
|---------|---------|
| `./scripts/herd/new-run.sh ["goal"]` | Create `artifacts/herd/<UTC-id>/`, set `CURRENT`, mkdir `lanes` + `locks` |
| `./scripts/herd/register.sh …` | Acquire OWN locks, write lane card from template, pulse `claimed`/`working`, print card path |
| `./scripts/herd/pulse.sh <lane> --status …` | Merge lane JSON (`working`, `blocked`, `done`, `failed`, …) |
| `./scripts/herd/status.sh` | Table of CURRENT lanes + counts by status |
| `./scripts/herd/wait-all.sh [--timeout 600]` | Poll until all lanes are terminal (`done` / `failed` / `blocked`) |
| `./scripts/herd/own-lock.sh acquire\|release\|list\|held-by` | Exclusive path locks for a lane |
| `./scripts/herd/own-check.sh path…` | Director preflight: exit 2 if any path already locked |
| `./scripts/herd/finish.sh <lane> --goal-met yes\|no\|blocked` | Release OWN locks; pulse `done` / `failed` / `blocked` |

### Register example

```bash
./scripts/herd/new-run.sh "UI dedupe: stage flag + friends offline"

./scripts/herd/register.sh \
  --lane lane-a \
  --goal "Stage flag chip off when dock shows partner" \
  --own "mobile/src/live/LiveStageVideo.tsx" \
  --done-when "no dual 🇨🇦 on stage" \
  --do-not "MediaSession.ts, deploy, APK, pool>0" \
  --agent grok-sub \
  --read "docs/HERD.md" \
  --read "knowledge/specs/current-ui-dedupe-connect-cleanup.md"
# paste printed lanes/lane-a.md into spawn_subagent
```

### Pulse / finish / wait

```bash
./scripts/herd/pulse.sh lane-a --status working --agent grok-sub
./scripts/herd/pulse.sh lane-a --status blocked --reason "needs human smoke"
./scripts/herd/finish.sh lane-a --goal-met yes --notes "flag gated off"
./scripts/herd/status.sh
./scripts/herd/wait-all.sh --timeout 900
```

### OWN locks (standalone)

```bash
./scripts/herd/own-lock.sh acquire lane-a mobile/src/live/LiveStageVideo.tsx
./scripts/herd/own-lock.sh list
./scripts/herd/own-lock.sh held-by mobile/src/live/LiveStageVideo.tsx
./scripts/herd/own-lock.sh release lane-a
./scripts/herd/own-check.sh mobile/src/media/MediaSession.ts   # exit 0 if free
```

---

## State machine

```text
idle → claimed → working → blocked | done | failed
```

| Status | Meaning |
|--------|---------|
| `idle` | Lane slot exists; not claimed |
| `claimed` | Card registered; agent assigned |
| `working` | Implementer actively editing OWN |
| `blocked` | Waiting on human/smoke/other lane (`goal_met=blocked`) |
| `done` | Finished with `goal_met=yes` |
| `failed` | Finished with `goal_met=no` |

Workers report in the card **REPORT** block:

```text
GOAL_MET=yes|no|blocked
FILES_CHANGED:
NOTES:
```

---

## OWN non-overlap rules

1. **One writer per path** — if `own-lock` says another lane holds it, do not spawn a second writer.
2. **OWN is exclusive** — workers edit only listed paths; everything else is READ or out of scope.
3. **Director checks** — `own-check.sh` before `spawn_subagent`; `register.sh` acquires locks when available.
4. **No dual MediaSession** — never Grok + Claude thrashing `mobile/src/media/MediaSession.ts` (or the same live hop) in parallel.
5. **Release on finish** — `finish.sh` / `own-lock release` so the next hop can take the path.

Overlapping OWN is a process bug, not a “merge later” feature.

---

## When to multi-agent

| Situation | Action |
|-----------|--------|
| Single FAIL / one module | **One** implementer (or av-loop single writer) |
| UX polish without independent tickets | One implementer + optional verify-only |
| Human lists **≥2 independent FAIL lines** with **non-overlapping OWN** | Herd: `new-run` → register lanes → spawn → `wait-all` |
| Connect / black cam / force_relay | Prefer **`./scripts/av-loop.sh`** — not multi-writer herd on media |

Multi-agent without independent FAILs caused thrash (Modal races, APK flood). See `AGENTS.md` Always and the UX thrash process notes.

---

## Connect do-not-touch (always in DO NOT for non-connect lanes)

| Rule | Why |
|------|-----|
| No **MediaSession** thrash / dual writers | One-way video, offer thrash |
| `iceCandidatePoolSize` **must stay 0** | pool>0 breaks path / hooks deny |
| **force_relay sticky** — arm only on true; clear hangup/Next only | Mid-call pure-relay arm blacks media |
| No dual-offer / answerer re-offer | 18s black / thrash |
| No unprompted `push.sh` / APK flood | Human owns ship + smoke gate |

Locks: `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md`, `.grok/hooks/`.

For A/V product FAIL, use **av-loop** (measure → ONE writer → verify-after). Herd does not replace the scorecard director.

---

## Example: multi-lane UI cleanup (past session pattern)

Matches `knowledge/specs/current-ui-dedupe-connect-cleanup.md` — independent FAIL lines, non-overlapping OWN.

| Lane | FAIL / goal | OWN only | DO NOT |
|------|-------------|----------|--------|
| **A** | Dual 🇨🇦 — stage flag off when dock owns partner | `mobile/src/live/LiveStageVideo.tsx` | MediaSession, deploy, APK |
| **B** | Friends offline — one retry CTA | `mobile/app/friends.tsx` | connect path |
| **C** | Dead mute chrome cleanup | `LiveStatusBanners.tsx`, `PartnerChrome.tsx` | MediaSession |
| **D** | Mute toast / thin modal shell | `mobile/app/live.tsx` (chrome only) | ICE, pool, force_relay |
| **E** | Connect mess **inventory only** | read-only → `knowledge/raw/` | any SDP/ICE policy change |

```bash
./scripts/herd/new-run.sh "UI single-surface + safe connect inventory"
# register A–D with distinct --own; E as explore / read-only agent
# spawn_subagent per card (or Claude worktree per non-overlapping OWN)
./scripts/herd/wait-all.sh --timeout 1200
./scripts/herd/status.sh
# unit: node mobile/scripts/test-live-units.mjs (or dev-smoke --unit)
# no APK until human smoke if user-visible
```

---

## Integration with av-loop

| System | Role |
|--------|------|
| **Herd** | **General** multi-lane shepherd: any product lanes with OWN + DONE WHEN |
| **av-loop** | **Product A/V director**: `av-verify` scorecard → route → `grok-job` / `claude-job` → **verify-after** |

```text
Connect/A/V black cam:
  ./scripts/av-loop.sh          # measure + ONE writer job card
  → implement
  → verify-after / av-verify

Independent UI FAILs (non-connect):
  ./scripts/herd/new-run.sh …
  → register + own-lock + spawn
  → wait-all + unit smoke
```

Do **not** run multi-lane herd writers on `MediaSession.ts` / `ui/webrtc.js` while av-loop already owns the connect hop. Optional parallel **read-only** diagnose is fine.

Related: `docs/AGENT_LOOP_DESIGN.md`, `docs/AGENTIC_ENGINEERING.md`, skill `claude-worker`, `docs/AGENT_GROK_CLAUDE.md`.

---

## Quick director checklist

1. [ ] ≥2 independent FAIL lines? Else single writer.  
2. [ ] `new-run` + non-overlapping OWN per lane.  
3. [ ] `own-check` / register locks green.  
4. [ ] Job cards include DO NOT (connect thrash, pool, deploy).  
5. [ ] Spawn workers; `status` / `wait-all`.  
6. [ ] `finish` each lane; release locks.  
7. [ ] Verify gate matches DONE WHEN (unit / smoke / av-verify).  
8. [ ] Compound wiki if evidence solid.
