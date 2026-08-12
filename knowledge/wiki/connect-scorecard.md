# Connect scorecard

## How to measure

```bash
./scripts/av-verify.sh --min 15
./scripts/av-loop.sh --min 10          # + product route + job cards + verify-after
```

Read: `artifacts/av-verify/latest.md` + `latest.json` → **`verdict` and `product`**.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | PASS or IDLE |
| 1 | FAIL |
| 2 | Tool/SSH error |
| 3 | WARN (includes **PRODUCT one-way** even if TURN HOT) |

## Fields that matter

| Field | Meaning |
|-------|---------|
| `verdict` | Infra: signaling + TURN + gates |
| `product.status` | **ok / one-way / partial / no-media / idle / unknown** |
| `product.done` | true only when both video directions meet min frames |
| offers / answers | Signaling |
| force_relay + `product.force_relay_mismatch` | Hub vs phone pure-relay latch |
| max_rb / peer_hot | Real TURN media bytes |
| err_437 | ALLOCATE thrash |
| app_vc / bind_v | Installed APK proof / bind success |

## DONE WHEN (product)

Human: both faces + audio ≥20s same Wi‑Fi, Hide IP off.  
Machine: `product.status=ok` (web frames_in≥10 **and** android frames_out≥10).

**Do not ship on verdict=PASS if product is one-way.**
