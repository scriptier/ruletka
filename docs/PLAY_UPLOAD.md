# Google Play Console — upload (current)

Package: **`me.ruletka.app`**  
**Ship tip:** **0.1.280 · versionCode 288** (connect lock + location + bars + post-call Start)  
Ops: [`PLAY_OPS.md`](PLAY_OPS.md) · Data safety: [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) · **Checklist:** [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md) · **Today:** [`PLAY_TODAY.md`](PLAY_TODAY.md)

## Ready binaries

```text
# Sideload (device smoke) — always keep current
mobile/artifacts/ruletka-0.1.280-vc288.apk
mobile/artifacts/ruletka-android-latest.apk
mobile/artifacts/ruletka-latest.apk

# Play Console — AAB
mobile/artifacts/ruletka-0.1.280-vc288.aab
# or: cd mobile && ./scripts/build-aab-local.sh
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

### 1) Internal testing (recommended first)

1. **Testing → Internal testing → Create new release**
2. Upload AAB from `mobile/artifacts/` (versionCode **>** last published)
3. **Release name:** `0.1.220 (228)` (or current from `app.json`)
4. **Release notes** — run `./scripts/play-status.sh --notes` or:

```
0.1.220 (228) — closed testing

• Blur: eye button on call bar + full-screen soft veil
• Mute: banners you-muted / they-muted-you; hub notify partner
• Partner card: name · location · ★ (long-press copy)
• Android video under chrome so badges actually show
• Gifts show who you’re gifting
• Play↔PC TURN same Wi‑Fi; Friends Call/Chat
• Home Privacy · Terms · Safety; 18+ · CSAE

Hub: https://ruletka.vip
Support: support@ruletka.me
```

5. **Review → Start rollout to Internal testing**
6. **Testers** → add emails / Google Group; open **opt-in link** on each device once

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
