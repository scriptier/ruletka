# Google Play ops (closed / internal testing)

Package: **`me.ruletka.app`**  
Companion: [`PLAY_UPLOAD.md`](PLAY_UPLOAD.md) · [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) · [`PLAY_TODAY.md`](PLAY_TODAY.md) · [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md)

## Current binary (local build)

| Field | Value |
|-------|--------|
| Version name | **0.1.223** |
| versionCode | **231** |
| APK (sideload) | `mobile/artifacts/ruletka-0.1.223-vc231.apk` · `ruletka-latest.apk` |
| AAB (Console) | `mobile/artifacts/ruletka-0.1.223-vc231.aab` |
| Handoff notes | `mobile/artifacts/PLAY-INTERNAL-0.1.223.txt` |
| Signing | Play upload keystore (`mobile/secrets/ruletka-upload.jks`) |
| targetSdk | 35 |
| Minify / R8 | **Off** — ignore “upload deobfuscation file” warning |

**0.1.223 highlights:** blur (unmount + Modal); they-muted Alert + bar under stage; fast linking (blur off default); partner card; gifts “To {partner}”.

Rebuild:

```bash
cd mobile
# bump versionName / versionCode in app.json when shipping a new cut
./scripts/build-apk-local.sh
./scripts/build-aab-local.sh
./scripts/play-status.sh
./scripts/play-status.sh --notes
```

Preflight:

```bash
cd mobile && ./scripts/play-status.sh   # expect 19 OK, 0 FAIL
```

---

## Testing tracks

| Track | When |
|-------|------|
| **Internal** | Now — upload AAB, small email list |
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
