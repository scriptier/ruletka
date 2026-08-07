# Google Play ops (closed testing)

Package: **`me.ruletka.app`**  
Companion: [`PLAY_UPLOAD.md`](PLAY_UPLOAD.md) · [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) · [`STORE.md`](STORE.md)

## Current binary (local build)

| Field | Value |
|-------|--------|
| Version name | **0.1.136** |
| versionCode | **144** |
| APK (sideload) | `mobile/artifacts/ruletka-0.1.136-vc144.apk` · `ruletka-latest.apk` |
| AAB | Build with `./scripts/build-aab-local.sh` before Console upload |
| Signing | Play upload keystore (`mobile/secrets/ruletka-upload.jks`) |
| targetSdk | 35 |
| Minify / R8 | **Off** — ignore “upload deobfuscation file” warning |

**0.1.136 highlights (closed test):** connect thrash / phone black-screen fixes; partner mute + debate DC; horizontal multi layout; friend-call UX; adaptive A/V; CONNECTIVITY_LOCK smoke (Play↔PC).

**Internal-test handoff:** [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md)

Rebuild:

```bash
cd mobile
# bump versionName/versionCode in app.json + android/app/build.gradle first
npx tsc --noEmit
cd android && ./gradlew :app:bundleRelease
# → copy AAB to mobile/artifacts/ruletka-<ver>-vc<code>.aab
# or: ./scripts/build-aab-local.sh <versionCode>
```

Preflight:

```bash
cd mobile && ./scripts/preflight.sh
cd mobile && ./scripts/play-status.sh
```

---

## Closed testing — recommended countries (alpha)

Start **narrow** so support load stays small and you can iterate weekly:

| Priority | Markets | Why |
|----------|---------|-----|
| 1 | **Canada, United States** | Operator locale; English UI primary |
| 2 | **United Kingdom, Ireland** | EN + policy-similar |
| 3 | **Poland, Czechia** | EU EN-capable testers |
| Later | **Ukraine, Germany, Brazil** | After internal track is green |

Avoid **worldwide open** until:

1. Internal track has ≥2 real people on friend-call + stranger match  
2. CSAE / Data safety / content rating forms complete  
3. Support mailbox (`support@ruletka.me` + CSAE contact) is monitored daily  

Play path: **Internal testing** (email list) → **Closed testing** (country set) → Production.

---

## CSAE / child safety (Play form)

| Field | Value |
|-------|--------|
| Standards URL | **https://ruletka.vip/legal/child-safety.html** |
| In-app | Settings → Child safety standards · Rules 18+ gate |
| Contact | **anton@shopops.ca** (or support@ruletka.me if both monitored) |
| Age | **18+ only** — not for children; Families Policy **does not apply** |

Check both compliance acknowledgements on the Play CSAE form when submitting.

---

## Console forms checklist

| Form | Doc / answer |
|------|----------------|
| Data safety | [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) |
| Content rating (IARC) | Expect Mature 17+; app gate is 18+ |
| Target audience | 18+ only |
| Ads | No |
| App access (reviewer) | Paste from `PLAY_UPLOAD.md` §5 |
| Privacy policy | https://ruletka.vip/legal/privacy.html |
| Delete account / data | https://ruletka.vip/legal/delete.html |
| Store listing copy | `mobile/assets/store/LISTING.md` |
| Screenshots | `mobile/assets/store/screenshots/` (phone + 7" + 10") |
| Feature graphic | `mobile/assets/store/play-feature-1024x500.png` |
| Icon | `mobile/assets/store/app-icon-1024.png` |

### Known non-blockers

| Message | Action |
|---------|--------|
| No deobfuscation / mapping file | **Ignore** while `minifyEnabled` is false |
| versionCode must be higher | Bump gradle `versionCode` |
| Must target API 35 | Already set |

---

## Internal / closed release notes (paste)

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

Regenerate anytime:

```bash
cd mobile && ./scripts/play-status.sh --notes
```

---

## Manual upload steps (no service account yet)

`mobile/secrets/google-play.json` is **optional**. Until present:

1. [Play Console](https://play.google.com/console) → **me.ruletka.app**  
2. **Testing → Internal testing → Create new release**  
3. Upload `mobile/artifacts/ruletka-0.1.64-vc72.aab`  
4. Paste release notes above  
5. **Start rollout to Internal testing**  
6. Testers → email list / Google Group → share **opt-in link**  
7. On device: accept opt-in → install from Play → Settings shows build `0.1.64 (72)`

When JSON exists:

```bash
cd mobile
npx eas-cli submit --profile production --platform android \
  --path artifacts/ruletka-0.1.64-vc72.aab
```

(`eas.json` submit track is **internal**.)

---

## Device smoke (testers)

See [`DEVICE_SMOKE.md`](DEVICE_SMOKE.md). Minimum for closed alpha:

1. Age gate → permissions → Home  
2. Live: local preview  
3. Match with browser https://ruletka.vip/live.html  
4. Friends: code → Call both ways  
5. Report / Block once (can be on a test peer)  
6. Settings: legal links + child-safety open  

---

## After each ship

1. Copy AAB to `mobile/artifacts/`  
2. Host APK: `ui/download/ruletka-android-latest.apk` + `ANDROID-LATEST.txt`  
3. Bump this file’s “Current binary” table  
4. Update `PLAY_UPLOAD.md` current version line  
5. Internal track rollout  
