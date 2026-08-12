# Spec: same-WiFi PC ↔ Android A/V

> **DONE** 2026-08-10 — product.ok on APK 0.1.297/vc305.

```text
GOAL: PC browser and Android same Wi‑Fi both faces + audio
DONE WHEN: product.status=ok (achieved)
EVAL: av-verify product.ok + app_vc≥305 pure when hub force_relay
STATUS: Done — regression only (do not thrash pure/bind/encode)
```

### Regression smoke

Install latest APK · hard-refresh PC · Start once · `./scripts/av-verify.sh --min 10`  
Expect: product.ok, both fin/fout >0.

### Related

Linking speed is a **new** goal: `knowledge/specs/current-linking-speed.md`.
