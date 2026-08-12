---
description: Run ruletka av-verify scorecard (hub + coturn) and show latest.md / latest.json. Augmentation only — no APK/deploy.
---

# /av-verify

You **augment** the human with a connect scorecard. Do **not** build APK, deploy, or change ICE policy unless the user already asked for a fix in this turn.

## Steps

1. Ensure cwd is the freenet-roulette repo root (contains `scripts/av-verify.sh`).
2. Parse optional args from the user message:
   - minutes → `--min N` (default `15`)
   - `wait` / `wait N` → `--wait 90` or `--wait N`
   - `coturn` → `--coturn`
   - `watch N` → `--watch N`
3. Run:

```bash
./scripts/av-verify.sh --min 15
# adjust flags from step 2
```

4. Read and summarize for the human:
   - `artifacts/av-verify/latest.md` (primary)
   - `artifacts/av-verify/latest.json` verdict + gates
5. Plain language: what is OK (signaling?) vs broken (answers=0? max_rb tiny? 437 storms? no av_path?).
6. Propose **at most one** next step (smoke / client-ice / turn-media / wait). Do **not** implement unless the user asks.
7. Exit code meaning: `0` PASS/IDLE · `1` FAIL · `2` tool error · `3` WARN — report the code.

## Never

- `build-apk-local.sh`, `push.sh`, Play upload
- Flip `force_relay` / pool size “while we’re here”
