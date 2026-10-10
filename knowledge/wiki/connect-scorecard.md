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

## Residual stamps (2026-08-12 — cite only)

| Stamp | verdict | product | android | mto / mta | NEXT_ROLE | Source |
|-------|---------|---------|---------|-----------|-----------|--------|
| `20260812T064214Z` | **PASS** | **ok** done=true · web 670/776 · android **756/678** · app_vc **382** · tip **0.1.374** | av_path **yes** · platforms **web↔android** | **1895 / 3122** | **ship**/idle (scorecard) | `CONN-smoke-phone-avpath-RESULT` |
| `20260812T051553Z` | **PASS** | **ok** done=true · web 3851/4257 · android 32/6 · app_vc **376** | av_path **yes** | **1633 / 3697** | was web-kick | `CONN-overnight-verify-RESULT` |
| `20260812T062732Z` | **WARN** | **one-way** done=false · web 451/446 · android 0/0 · app_vc **null** | av_path **no** · platforms **web↔web** | **1342 / 5793** | **smoke** (then closed by phone smoke) | `CONN-verify-after-mx-RESULT` |

- Phone-smoke + overnight product.ok **≠** linking-speed GOAL_MET (mto/mta above stretch).  
- After-MX WARN was **(A) no phone in window** — phone smoke restored android av_path for that window only.  
- **No invent multi PASS** — stamps above are 1v1 connect. Multi SoftBlur device still **BLOCKED** keyguard (F17/F18).  
- See [linking-speed](linking-speed.md).

## Residual stamps (2026-08-20 — cite only)

| Stamp | verdict | product | android | signaling | Source |
|-------|---------|---------|---------|-----------|--------|
| `20260820T203346Z` | **FAIL** | **unknown** done=false · web 0/0 · android 0/0 · app_vc **464** · bind_v **0** | av_path **yes** (android only) · `ice=new` / `cs=new` / `sig=stable` whole window · `force_relay_hub=true` | matches=3 offers=2 **answers=0** (phone never answered) | `20260820T203320Z-1v1-linking.md` + gotcha **70** |

- TURN was HOT this window (`max_rb=641559 peer_hot=61`) — infra fine, product FAIL is answers=0 on the phone leg only.
- Do not conflate with the `relayWaitBudgetMs` **480** tuning lock — see gotcha **70**.
- **No product.ok invent.**
