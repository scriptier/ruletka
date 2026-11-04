---
name: herd
description: >
  Multi-lane subagent herd for freenet-roulette: new-run, register non-overlapping
  OWN locks, spawn_subagent with card text, wait-all / pulse, finish, verify.
  Use when user says herd, multi-agent, shepherd, fire lanes, max subagents,
  OWN locks, parallel lanes, or wants several workers without dual-write thrash.
metadata:
  short-description: "Multi-lane herd (OWN locks + spawn + verify)"
  triggers:
    - herd
    - multi-agent
    - shepherd
    - fire lanes
    - max subagents
    - OWN locks
    - parallel lanes
    - non-overlapping OWN
---

# Herd — multi-lane subagents (OWN locks)

**Stance:** Grok is **shepherd** (director). Subagents are **lanes** with **non-overlapping OWN**.  
Human smokes connect. Claude factory queue stays separate; herd is parallel Grok-side lanes.

**Full map:** [`docs/HERD.md`](../../../../docs/HERD.md)  
**Factory status:** `./scripts/agents/status.sh` (prints herd CURRENT when active)  
**Smoke:** `./scripts/herd/smoke-test.sh`

## When to use

| Trigger | Action |
|---------|--------|
| User says **herd** / **shepherd** / **fire lanes** | Open a run; register ≥2 lanes |
| **Max subagents** / parallel independent FAILs | One lane per OWN set (cap ~5) |
| **OWN locks** conflict risk | `own-check` / reject overlapping paths |
| Single scoped hop | Prefer one implementer — **not** herd |
| Connect thrash / MediaSession | **One writer only**; no dual MediaSession without human |

## Hard rules

1. **Non-overlapping OWN** — every path in at most one live lane. Overlap → do not spawn.  
2. **Never dual-write `MediaSession` without human** — MediaSession / deep connect is single-writer.  
3. **Never skip verify-after for connect** — after any connect/A/V lane: `av-verify` / `verify-after` before GOAL_MET.  
4. **One shepherd** — Grok registers, spawns, pulses, finishes.  
5. **No deploy / push / Play** from a lane unless card + human allow.  
6. **pool=0** forever; no ICE thrash for layout-only.

## Layout (`artifacts/herd/`)

```text
artifacts/herd/
  CURRENT                 # symlink → <run_id>
  <run_id>/
    run.json              # { run_id, created_at, goal, status }
    lanes/<lane_id>.json  # status machine + own + goal_met
    lanes/<lane_id>.md    # job card (spawn_subagent paste)
    locks/<path>.lock     # OWN exclusive locks
```

See **`docs/HERD.md`** for state machine and OWN rules.

## Steps (shepherd)

```text
new-run → register lanes (OWN check) → spawn_subagent(card) → wait-all / pulse → finish → verify
```

### 1. new-run

```bash
cd /home/drakosik/freenet-roulette
./scripts/herd/new-run.sh "short goal"
./scripts/herd/status.sh
```

### 2. register lanes (non-overlapping OWN)

```bash
./scripts/herd/own-check.sh path/a path/b   # exit 2 if locked

./scripts/herd/register.sh \
  --lane lane-a \
  --goal "…" \
  --own "path/a" \
  --done-when "…" \
  --do-not "MediaSession.ts, deploy, APK, pool>0" \
  --agent grok-sub \
  --read "docs/HERD.md"
# paste printed card into spawn_subagent

# Or pulse-only (machine state):
./scripts/herd/pulse.sh lane-a --status claimed --own "path/a" --goal "…"
./scripts/herd/pulse.sh lane-a --status working --agent grok-sub
./scripts/herd/own-lock.sh acquire lane-a path/a
```

Safe parallel: `ui/i18n` vs `docs/PLAY_*` vs `mobile/app/friends.tsx`.  
Unsafe: two lanes both on `MediaSession.ts` or same `live.js` hop.

### 3. spawn_subagent with card text

For each registered lane: paste full `lanes/<id>.md` as the worker prompt.  
Do not re-edit OWN mid-flight without re-register / re-lock.

### 4. wait-all / pulse

```bash
./scripts/herd/pulse.sh lane-a --status working
./scripts/herd/pulse.sh lane-a --status blocked --reason "needs smoke"
./scripts/herd/status.sh
./scripts/herd/wait-all.sh --timeout 900
```

Terminal statuses: `done` | `failed` | `blocked`.

### 5. finish

```bash
./scripts/herd/finish.sh lane-a --goal-met yes|no|blocked --notes "…"
# releases OWN locks + pulses terminal status + stamps REPORT on card
```

### 6. verify

| Lane type | Verify |
|-----------|--------|
| Non-connect UI/docs/i18n | `./scripts/dev-smoke.sh --unit` |
| Connect / A/V / MediaSession | **`./scripts/av-verify.sh`** + **verify-after** — **mandatory** |
| Multi-party layout only | unit + human multi smoke (no invent PASS) |

Then: `./scripts/agents/harvest.sh` if Claude worktree involved.  
Compound: `/knowledge-compound` when evidence solid.

## Max lanes

Default cap **5** concurrent (matches `tasks/grok-loop`).  
If full: pulse/harvest only — do not spawn.

## Relation to Claude factory

| System | Path | Role |
|--------|------|------|
| **Herd** | `artifacts/herd/` + `scripts/herd/` | Parallel Grok subagents + OWN locks |
| **Claude factory** | `tasks/admin-queue/` + `scripts/agents/*` | Sequential Claude worktree worker |

Do **not** dual-write the same OWN across herd lane vs Claude task.  
`./scripts/agents/status.sh` surfaces queue **and** herd CURRENT.  
`./scripts/agents/harvest.sh` lightly notes herd lane results when CURRENT exists.

## Smoke

```bash
./scripts/herd/smoke-test.sh
# new-run → 2 fake non-overlapping lanes → pulse done → status → wait-all → finish
```

## Never

- Dual-write **MediaSession** (or same connect hop) without human  
- Skip **verify-after** for connect lanes  
- Overlapping OWN  
- Claim connect PASS without scorecard / human faces  
- Deploy / APK flood from a lane without authorization  

## Related

- `docs/HERD.md` · `docs/AGENT_GROK_CLAUDE.md` · `docs/CHANGE_LANES.md`  
- skill `claude-worker` · `agentic-engineering` · `av-fix-loop`  
- `AGENTS.md` dual-agent rules · `tasks/grok-loop/README.md`
