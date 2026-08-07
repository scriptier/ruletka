# Google Play Console — upload (current)

Package: **`me.ruletka.app`**  
Current local binary: **0.1.98 · versionCode 97**  
Ops checklist: [`PLAY_OPS.md`](PLAY_OPS.md) · Data safety: [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md)

## Ready AAB (upload this)

```text
mobile/artifacts/ruletka-0.1.98-vc106.aab
```

~56 MB · signed with Play upload keystore (`mobile/secrets/ruletka-upload.jks`)  
Sideload APK: https://ruletka.vip/download/ruletka-android-latest.apk

### Rebuild anytime

```bash
cd mobile
./scripts/build-aab-local.sh          # uses versionCode in android/app/build.gradle
./scripts/build-aab-local.sh 98     # next Play upload must be versionCode > last published
./scripts/play-status.sh            # readiness + pasteable release notes
./scripts/play-status.sh --notes
```

Needs: Android SDK 35 + JDK 17 + keystore files in `mobile/secrets/` (see `secrets/README.md`).

---

## Play Console — step by step

Open: [play.google.com/console](https://play.google.com/console) → app **me.ruletka.app**

### 1) Internal testing (recommended first)

1. **Testing → Internal testing → Create new release**
2. Upload: `mobile/artifacts/ruletka-0.1.98-vc106.aab`
3. **Release name:** `0.1.98 (106)`
4. **Release notes** (EN — or `./scripts/play-status.sh --notes`):

```
0.1.98 (106) — closed testing

• Start flips to Next/Stop immediately; icon mic/cam/flip/friends
• Friends icon: share invite or open Friends
• Rate/review only after chats of 5+ minutes
• Adaptive A/V + soft/hard reconnect (phone↔browser)
• Friends call/DMs; report + block; 18+ gate
• Child safety: ruletka.vip/legal/child-safety.html

Hub: https://ruletka.vip
Support: support@ruletka.me
```

5. **Review → Start rollout to Internal testing**
6. **Testers** tab → add email list / Google Group  
7. Copy the **opt-in link** and open it on each test device (must accept once)

### 2) Closed / open testing (later)

Same AAB can be promoted: **Promote release** → Closed testing → Production when ready.

### 3) Store listing (if empty)

Copy from `mobile/assets/store/LISTING.md`.
