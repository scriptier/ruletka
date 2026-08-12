---
description: Multi-agent loop — measure, product route, spawn ONE writer, mandatory verify-after. No unprompted APK.
---

# /av-loop

Director protocol for ruletka connect. Karpathy: Spec → Verifier → Environment.

## Spec (default DONE WHEN)

- Human: both faces + audio ≥30s same Wi‑Fi  
- Machine: `product.status=ok` (web frames_in≥10 **and** android frames_out≥10)

Active: `knowledge/specs/current-av.md`

## Steps

### 1. Measure + route

```bash
./scripts/av-loop.sh --min 15
# human about to smoke:
# ./scripts/av-loop.sh --min 10 --wait 90
```

Read:

| Artifact | Use |
|----------|-----|
| `artifacts/av-loop/NEXT_ROLE` | Who to spawn |
| `artifacts/av-loop/PRODUCT` | product.status |
| `artifacts/av-loop/director.md` | Spawn protocol |
| `artifacts/av-loop/grok-job.md` | Grok prompt |
| `artifacts/av-loop/claude-job.md` | Claude prompt |
| `artifacts/av-loop/verify-after.md` | **Mandatory** after implementer |
| `artifacts/av-verify/latest.json` | `verdict` + `product` |

### 2. Spawn (one writer)

| NEXT_ROLE | Action |
|-----------|--------|
| smoke | `/smoke-hint` — no agent |
| diagnose / verify-only | Grok RO + `grok-job.md` |
| client-ice / turn-media | **One** of: Grok implementer **or** Claude on PRIMARY FILE |
| ship | Stop; human faces; compound |

**Do not** dual-write MediaSession. Prefer one writer. If both: reconcile + rebuild APK if source newer.

### 3. Verify-after (never skip after implementer)

```bash
./scripts/av-verify.sh --min 10
# or spawn verify-only with verify-after.md
```

- worse → REVERT  
- product still one-way → next hop or smoke  
- code shipped mobile → human install APK first  
- hops ≥ 2 without smoke → STUCK  

### 4. Compound

After PASS / STUCK / solid diagnosis: `/knowledge-compound`

## Output to human

```
VERDICT: …
PRODUCT: …
NEXT_ROLE: …
HUMAN: …
GOAL_MET: yes|no|blocked
```

GOAL_MET=yes only if product.ok or human both faces.
