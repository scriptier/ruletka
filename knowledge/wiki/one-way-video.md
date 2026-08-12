# One-way video (PC black) — RESOLVED 2026-08-10

**Status: PASS** — product.ok with APK **0.1.297 / vc305**.

## Final proof (av-verify)

```text
verdict=PASS product=ok app_vc=305 bind_v=1 hub_fr=1 force_relay=1 policy=relay
web fin/fout high  android fin/fout both >0  relay_candidates offer/answer 1/1
```

## Failure chain (do not re-learn)

| Stage | Symptom | Root | Fix APK |
|-------|---------|------|---------|
| 1 | pure mismatch | hub pure, phone policy=all | sticky + closeCall keep sticky | 0.1.296 |
| 2 | bind miss | RN empty track.kind | m-line bindAnswerOutbound | earlier |
| 3 | mid-nego orphan | ensureRelayPolicyPc rebuild after bind | negotiating guard | 0.1.294 era |
| 4 | encoder dead | bind_v=1 but frames_out=0 | encodings.active + fresh GUM | **0.1.297** |

## Agent lane

**client-ice** only while max_rb HOT. Skill checklist: `.grok/skills/av-fix-loop/references/ONE_WAY.md`.

## MUST NOT (regression)

- Coturn thrash while lock PASS  
- pool > 0  
- clear hub force_relay sticky on keepLocal closeCall  
- claim fixed without product.ok  

### Log

- 2026-08-10: one-way proven; thrash through APKs 291–296.  
- 2026-08-10: **product.ok** on 0.1.297/vc305 after encoder-active fix. Skill lessons compounded.
