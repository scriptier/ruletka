# Play internal-test readiness (human handoff)

**Package:** `me.ruletka.app`  
**Ship tip (sideload):** **0.1.136 / versionCode 144** (or later that still respects CONNECTIVITY_LOCK)  
**Lock:** [`CONNECTIVITY_LOCK.md`](CONNECTIVITY_LOCK.md) · smoke: [`DEVICE_SMOKE.md`](DEVICE_SMOKE.md)

**Out of scope for this checklist:** Play Console upload, bulk APK on website, production deploy.

---

## 0) Preflight (local)

```bash
cd mobile
./scripts/play-status.sh
./scripts/play-status.sh --notes   # pasteable EN release notes
```

| Check | Done |
|-------|------|
| `app.json` versionName / versionCode match intended release | ☐ |
| APK exists: `mobile/artifacts/ruletka-<ver>-vc<code>.apk` | ☐ |
| AAB exists (for Console): `./scripts/build-aab-local.sh` if missing | ☐ |
| Keystore present (`mobile/secrets/`) — no upload without it | ☐ |

---

## 1) Install + device smoke (before Internal track)

| # | Step | Done |
|---|------|------|
| 1 | Install APK on phone: `adb install -r mobile/artifacts/ruletka-latest.apk` | ☐ |
| 2 | Browser: **hard refresh** `https://ruletka.vip/live.html` | ☐ |
| 3 | **Play↔PC** (P0): both Start once; **no Next spam 15s** | ☐ |
| 4 | Hub: `force_relay=false` on normal path; **1 offer + 1 answer** | ☐ |
| 5 | Success: both cameras + audio (not permanent black) | ☐ |
| 6 | Optional: mute partner → other side sees mute visuals | ☐ |
| 7 | Optional: friend Call ring / Accept path | ☐ |

```bash
# Hub forensics after smoke
./scripts/hub-match-speed.sh 15 2000
# Target: max match_to_offer_ms < 2000; no offer-drop thrash on good path
```

---

## 2) Store listing (paste into Console)

| Asset / field | Path or value | Done |
|---------------|---------------|------|
| Short + full description (EN) | [`mobile/assets/store/LISTING.md`](../mobile/assets/store/LISTING.md) | ☐ |
| RU + other langs | [`mobile/assets/store/LISTING-I18N.md`](../mobile/assets/store/LISTING-I18N.md) | ☐ |
| Phone screenshots | `mobile/assets/store/screenshots/phone-*.png` | ☐ |
| 7" / 10" tablets | `tablet7-*` / `tablet10-*` | ☐ |
| Feature graphic 1024×500 | `mobile/assets/store/play-feature-1024x500.png` | ☐ |
| App icon 512 / 1024 | `mobile/assets/` + store icon assets | ☐ |
| Privacy / Terms / Delete / CSAE | See LISTING.md URL table | ☐ |

---

## 3) Data safety + policy forms

| Form | Doc | Done |
|------|-----|------|
| Data safety | [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) | ☐ |
| Content rating (IARC) | Expect Mature 17+; app gate **18+** | ☐ |
| Target audience | **18+ only** (not Families) | ☐ |
| CSAE / child safety | Standards URL: https://ruletka.vip/legal/child-safety.html | ☐ |
| Ads | **No** ads | ☐ |

---

## 4) Internal testing track (when you upload)

| Step | Done |
|------|------|
| Testing → Internal testing → Create release | ☐ |
| Upload AAB (versionCode **>** last published) | ☐ |
| Release notes from `./scripts/play-status.sh --notes` | ☐ |
| Start rollout to Internal testing | ☐ |
| Testers list / opt-in link opened on each device | ☐ |

Ops detail: [`PLAY_UPLOAD.md`](PLAY_UPLOAD.md) · [`PLAY_OPS.md`](PLAY_OPS.md)

---

## Explicit do-not

- Play Console **production** push without internal green smoke  
- Bulk APK dump to public site download tree  
- Claiming “Prefer Direct” as default (CONNECTIVITY_LOCK)  
- Always-on `force_relay` / SFU as default media path  
