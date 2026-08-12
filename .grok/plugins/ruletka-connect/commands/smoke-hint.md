---
description: Human smoke checklist for PC browser + Android A/V. No automation.
---

# /smoke-hint

Agentic next step when `NEXT_ROLE=smoke` or after APK ship. **Do not** build/deploy unless authorized.

## Install (if mobile changed this session)

- **A/V both-way (proven):** APK **0.1.297+** (prefer **0.1.298 / vc306** for faster answer)  
- Download: https://ruletka.vip/download/ruletka-android-latest.apk  
- Local: `mobile/artifacts/ruletka-0.1.298-vc306.apk`  
- Replace old app; confirm Settings / about if available

## Smoke steps

1. **PC:** hard-refresh live. Hide IP **off**.  
2. **Phone:** new APK installed.  
3. Both: **Start once**. Wait **≥20 seconds**. No Next spam.  
4. Look for: **both faces + audio**.  
5. Tell agent: **`smoked`** (or `still black` / `one-way` / `PC black only`).

## Agent then runs

```bash
./scripts/av-verify.sh --wait 90 --min 10
# or
./scripts/agentic-loop.sh --wait 90
```

**Good (product):**

- `product.status=ok`  
- android: `app_vc>=305`, pure OK, **`frames_out≥10`** (not just bind_v=1)
- web: `frames_in>=10`; android: `frames_out>=10`

## Spec

`knowledge/specs/current-av.md` — GOAL_MET only with product.ok or your faces.
