# RESULT: 011-pair-smoke-harden

## Status
DONE

## Completion promise
COMPLETE

## What changed
Hardened **hub-side** pair smoke path (Chrome pair-smoke already exists; hub asserts work when Chrome/bridge unavailable):

1. **`scripts/hub-match-speed.sh`** — now prints:
   - recent match/offer/answer lines
   - counts table (matches, offers, answers, drops, slow, max MTO)
   - **Verdict: PASS / WARN / FAIL / IDLE** vs threshold (default 2000ms)
   - Assert reminders: 1 offer+1 answer, MTO budget, no Next spam 15s

2. **`docs/DEVICE_SMOKE.md`** — new **Play ↔ PC connect smoke (P0)** section:
   - Manual APK + hard-refresh steps
   - Hub assert commands (`hub-match-speed` + admin forensics-only)
   - Optional `pair-smoke.mjs` note
   - Connect fail matrix
   - Version note → 0.1.123 / local APKs

Existing: `scripts/pair-smoke.mjs` already asserts 1 offer + 1 answer + remote track (needs Chrome).

## Files
- `scripts/hub-match-speed.sh`
- `docs/DEVICE_SMOKE.md`

## Verify ran
```bash
./scripts/hub-match-speed.sh 90 2000
```

## Connect risk
safe to merge after smoke — scripts/docs only; no client/WebRTC change

## Handoff for morning
- After next Play↔PC call: run hub-match-speed and expect PASS
- merge: not a branch; main workspace edits
- do not: deploy without smoke
