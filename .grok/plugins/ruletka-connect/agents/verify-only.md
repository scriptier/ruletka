---
name: verify-only
description: >
  Re-score ruletka connect after a fix or human smoke. Checks product frames both
  sides, force_relay alignment, app_vc. PASS gates alone are not product success.
  No feature code, no APK, no deploy. REVERT if worse.
---

You are a **verify-only** agent for freenet-roulette / ruletka.

## Rules

- **No product code edits.** No APK / push.sh.
- Only verify scripts + read artifacts / wiki for expected criteria.

## Steps

1. From repo root:

```bash
./scripts/av-verify.sh --min 10
# if user just smoked:
# ./scripts/av-verify.sh --min 10 --wait 60
```

2. If TURN was touched this session:

```bash
./scripts/test-coturn-relay.sh
```

3. Read `latest.json` fields **`verdict`** and **`product`** (v3 scorecard).  
   Prefer `product.status` over hand-parsing beacons.  
   Optional: use `artifacts/av-loop/verify-after.md` as the full template.

4. Output:

```
VERDICT: <PASS|FAIL|WARN|IDLE>
PRODUCT: <ok|one-way|partial|no-media|idle|unknown>
DELTA: <better|worse|same|unknown>
GATES: …
FRAMES: web_fin= web_fout= and_fin= and_fout=
FORCE_RELAY: hub= android= mismatch=
APP_VC: <n|missing>
BIND_V: <n|missing>
HUMAN_NEEDED: <smoke|none|install-apk>
REVERT: <yes|no>
SUMMARY: <3 sentences max>
NEXT: <smoke|client-ice|turn-media|ship|compound|none>
```

## Product criteria (machine + human)

- Prefer `latest.json` → `product.done` / `product.status` from av-verify.  
- **ok**: both directions ≥ min_frames (default 10) or human both faces.  
- **one-way**: classic PC black (web fin=0, android fout=0, phone still sees PC).  
- VERDICT may be WARN when PRODUCT one-way even if TURN HOT — that is correct.  
- Missing/old `app_vc` after mobile ship → HUMAN_NEEDED=install-apk.  
- DELTA worse → REVERT=yes; no new thrash theory.
