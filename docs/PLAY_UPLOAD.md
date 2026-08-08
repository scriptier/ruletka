# Google Play Console — upload (current)

Package: **`me.ruletka.app`**  
**Ship tip:** **0.1.148 · versionCode 156** (Live soft toasts + friends polish; bump if newer)  
Ops: [`PLAY_OPS.md`](PLAY_OPS.md) · Data safety: [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) · **Checklist:** [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md)

## Ready binaries

```text
# Sideload (device smoke) — always keep current
mobile/artifacts/ruletka-0.1.148-vc156.apk
mobile/artifacts/ruletka-latest.apk

# Play Console — AAB
mobile/artifacts/ruletka-0.1.148-vc156.aab
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
3. **Release name:** `0.1.148 (156)` (or current from `app.json`)
4. **Release notes** — run `./scripts/play-status.sh --notes` or:

```
0.1.148 (156) — closed testing

• Connect: one offer per match; progressive Linking + Retry (no thrash)
• Gifts mid-chat unlocked; stage gift strip + chat bubbles
• Stop one-tap (no confirm); Report FAB + peer_id resolve
• Friends row: Online pill + labeled Call / Chat; soft toasts
• Live soft toasts (stars / report / add friend / party); fewer popups
• Friend call alerts copy + offline push register path
• Partner mute / debate over data channel; multi-party stack
• 18+ gate · Child safety: ruletka.vip/legal/child-safety.html

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
