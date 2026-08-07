# Google Play Console — upload (current)

Package: **`me.ruletka.app`**  
**Ship tip:** **0.1.136 · versionCode 144** (sideload APK)  
Ops: [`PLAY_OPS.md`](PLAY_OPS.md) · Data safety: [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) · **Checklist:** [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md)

## Ready binaries

```text
# Sideload (device smoke) — always keep current
mobile/artifacts/ruletka-0.1.136-vc144.apk
mobile/artifacts/ruletka-latest.apk

# Play Console — build AAB when ready to upload
cd mobile && ./scripts/build-aab-local.sh
# → mobile/artifacts/ruletka-0.1.136-vc144.aab  (or next versionCode)
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
3. **Release name:** `0.1.136 (144)` (or current)
4. **Release notes** — run `./scripts/play-status.sh --notes` or:

```
0.1.136 (144) — closed testing

• Connect: one offer per match; no 0.8s thrash / 20s black wait
• Partner mute visuals + debate over data channel (Play fix)
• Multi-party: horizontal stack layout
• Soft ICE / hard rebuild budgets restored (14s / 24s)
• Friends Call + DMs; report + block; 18+ gate
• Child safety: ruletka.vip/legal/child-safety.html

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
