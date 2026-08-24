# Google Play ops (closed / internal testing)

Package: **`me.ruletka.app`**  
Companion: [`PLAY_UPLOAD.md`](PLAY_UPLOAD.md) · [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) · [`PLAY_TODAY.md`](PLAY_TODAY.md) · [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md)

## Current binary (local build)

| Field | Value |
|-------|--------|
| Version name | **0.1.471** |
| versionCode | **479** |
| APK (sideload + site) | `mobile/artifacts/ruletka-0.1.471-vc479.apk` · `/download/ruletka-android-latest.apk` |
| AAB (Console) | `mobile/artifacts/ruletka-0.1.471-vc479.aab` — local only; **not** uploaded |
| Source of truth | `mobile/app.json` (`version` + `android.versionCode`) |
| Signing | Play upload keystore (`mobile/secrets/ruletka-upload.jks`) |
| targetSdk | 35 |
| Minify / R8 | **Off** — ignore “upload deobfuscation file” warning |

> **Historical:** older docs / handoff notes under `mobile/artifacts/PLAY-INTERNAL-0.1.22x*.txt` and mid-series **0.1.28x** builds are **not** the current ship tip.

Rebuild:

```bash
cd mobile
# bump versionName / versionCode in app.json when shipping a new cut
./scripts/build-apk-local.sh
./scripts/build-aab-local.sh   # tip AAB on disk: ruletka-0.1.471-vc479.aab
./scripts/play-status.sh
./scripts/play-status.sh --notes
```

Preflight:

```bash
cd mobile && ./scripts/play-status.sh
```

---

## Testing tracks

| Track | When |
|-------|------|
| **Internal** | When AAB exists — upload AAB, small email list (**human open**; no agent Console PASS) |
| **Closed** | After 1–2 days internal green (limited countries) |
| **Production** | Only after closed green + forms complete |

### Recommended countries (closed, later)

| Priority | Markets |
|----------|---------|
| 1 | Canada, United States |
| 2 | United Kingdom, Ireland |
| 3 | Poland, Czechia |
| Later | Ukraine, Germany, Brazil |

Avoid worldwide open until internal has real Play↔PC smoke, CSAE / Data safety / content rating done, and `support@ruletka.me` is monitored.

---

## Explicit do-not

- Production without internal green  
- Bulk public APK dump on the site  
- Always-on `force_relay` for every match (CONNECTIVITY_LOCK)  
- SFU as default media path  
- Claiming Console upload PASS without human confirmation  
