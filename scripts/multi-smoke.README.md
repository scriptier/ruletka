# multi-smoke — multi-party harness scaffold

**Status:** scaffold (B1 / BM2) · **Not** product multi PASS  
**Script:** `scripts/multi-smoke.mjs`  
**Plan:** `knowledge/specs/BLUR-MULTI-FINISH-PLAN.md` B1

## Why

Agents need a **runnable** way to spin **3 web** or **2 web + phone** without inventing 3-way GOAL_MET. 1v1 harnesses stay separate.

| Harness | Role |
|---------|------|
| `pair-smoke.mjs` | Local bridge 1v1 budgets |
| `prod-pair-media.mjs` | Prod 2-web frames/ICE |
| `phone-web-pair.mjs` | One headless partner for device smoke |
| **`multi-smoke.mjs`** | **3-web or 2-web+phone observe scaffold + scorecard** |
| **`multi-pair.mjs`** | **Sibling: MODE=web2\|web2phone\|web3 phase observe** |

## Run

```bash
# help (always works)
node scripts/multi-smoke.mjs --help

# default: 3 headless Chromium tabs on prod live.html
node scripts/multi-smoke.mjs
node scripts/multi-smoke.mjs --mode 3web

# 2 web partners + printed phone steps (adb not stolen)
node scripts/multi-smoke.mjs --mode 2web-phone

# shorter budget / local bridge URL
BUDGET_MS=20000 MULTI_SMOKE_URL=http://127.0.0.1:8797/live.html \
  node scripts/multi-smoke.mjs --mode 3web
```

Soft-skips (exit 0) if Chrome or `puppeteer-core` missing.

## Output

- Console: per-tick slim snapshots (`matched`, `peers`, ICE/frames)
- `artifacts/multi-smoke/last-scorecard.json` — always `multi_product_pass: false`
- Screenshots under `artifacts/multi-smoke/`

## Honesty

- Status is **SKIP | OBSERVE | SCAFFOLD** only
- **Never** treat this exit 0 as multi product PASS
- Human smoke (faces ≥60s after find-3rd) remains DONE WHEN

## Next (follow-up jobs)

1. Reliable `find_third` accept on bot B  
2. Assert `peerPcs.size >= 2` + dual remote tiles with frames  
3. Optional phone probe without exclusive adb thrash  
4. 4-way after 3-way observe is useful  
