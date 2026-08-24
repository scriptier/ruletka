# Google Play Console — upload (current)

Package: **`me.ruletka.app`**  
**Ship tip (sideload):** **0.1.471 · versionCode 479** (also on `/download/`)  
**AAB for tip:** `mobile/artifacts/ruletka-0.1.471-vc479.aab` — **not** uploaded to Play Console  
Ops: [`PLAY_OPS.md`](PLAY_OPS.md) · Data safety: [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) · **Checklist:** [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md) · **Today:** [`PLAY_TODAY.md`](PLAY_TODAY.md)

> **Historical:** tips **0.1.22x–0.1.28x** (e.g. 0.1.280/vc288) are not current. Source of truth: `mobile/app.json`.

## Ready binaries

```text
# Sideload (device smoke + website)
mobile/artifacts/ruletka-0.1.471-vc479.apk
mobile/artifacts/ruletka-android-latest.apk
mobile/artifacts/ruletka-latest.apk
ui/download/ruletka-android-latest.apk

# Play Console — AAB (local; human upload)
mobile/artifacts/ruletka-0.1.471-vc479.aab
```

Signed with Play upload keystore (`mobile/secrets/ruletka-upload.jks`).

### Rebuild anytime

```bash
cd mobile
./scripts/build-apk-local.sh --bump   # sideload + bump versionCode
./scripts/build-aab-local.sh          # AAB for Console (versionCode must rise)
./scripts/play-status.sh              # readiness
./scripts/play-status.sh --notes      # pasteable release notes
```

Needs: Android SDK 35 + JDK 17 + keystore in `mobile/secrets/`.

---

## Play Console — step by step

Open: [play.google.com/console](https://play.google.com/console) → app **me.ruletka.app**  
**Human open** — agents do not claim Console PASS / upload complete.

### 1) Internal testing (recommended first)

1. **Testing → Internal testing → Create new release**
2. AAB on disk: `mobile/artifacts/ruletka-0.1.471-vc479.aab`
3. Upload AAB from `mobile/artifacts/` (versionCode **>** last published; tip is **479**)
4. **Release name:** `0.1.471 (479)` (or current from `app.json`)
5. **Release notes** — run `./scripts/play-status.sh --notes` or draft from recent ship notes:

```
0.1.471 (479) — closed / internal testing

• Play↔PC connect path (see CONNECTIVITY_LOCK)
• Blur / mute / partner card / gifts mid-chat
• Friends Call / Chat; Home legal footer · 18+ · CSAE

Hub: https://ruletka.vip
Support: support@ruletka.me
```

6. **Review → Start rollout to Internal testing**
7. **Testers** → add emails / Google Group; open **opt-in link** on each device once

### 2) Closed / open testing (later)

Promote when internal smoke is green: Closed testing → Production.

### 3) Store listing

Copy from [`mobile/assets/store/LISTING.md`](../mobile/assets/store/LISTING.md)  
EN + RU: [`LISTING-I18N.md`](../mobile/assets/store/LISTING-I18N.md)  
Screenshots: `mobile/assets/store/screenshots/`

### 4) Data safety

Fill from [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md).

---

## Do not (automation / agents)

- Bulk APK upload to public site download tree  
- Production track without internal green smoke  
- Claiming always-on TURN / SFU as default  
- Inventing an AAB path that is not on disk  
- Claiming Console PASS without human confirmation  
