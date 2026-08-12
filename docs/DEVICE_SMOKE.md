# Mobile device smoke checklist

Run after a **native** build (`eas build` or `./gradlew :app:assembleRelease`).  
Expo Go is **not** enough for WebRTC.

## Current binary (update when shipping)

| Field | Value |
|-------|--------|
| Version | **0.1.283** / versionCode **291** (`mobile/artifacts/ruletka-android-latest.apk`) |
| APK | local `mobile/artifacts/ruletka-0.1.283-vc291.apk` (no bulk site APKs) |
| Notes | pure force_relay (same-IP) · no answerer promote · blur zOrder 0 mosaic · CONNECTIVITY_LOCK |
| Web | hard-refresh `live.html` → **`webrtc.js?v=285`** · `curl -s https://ruletka.vip/deploy.json` |
| Play handoff | [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md) · `PLAY_TODAY.md` |
| Debug | [`CONNECT_DEBUG.md`](CONNECT_DEBUG.md) · [`CHANGE_LANES.md`](CHANGE_LANES.md) |

```bash
# Gate before APK / human smoke (unit + web↔web pair budgets + rematch)
./scripts/dev-smoke.sh

# Or unit only / pair only:
./scripts/dev-smoke.sh --unit
./scripts/dev-smoke.sh --pair

# After human Play↔browser: hub forensics + scorecard line
./scripts/smoke-connect.sh --hub-only
./scripts/connect-scorecard.sh 60

# Scorecard history (append-only JSONL)
tail -5 artifacts/connect-scorecard.jsonl
```

## Privacy / resume package (0.1.226+)

| # | Check | Pass? |
|---|--------|-------|
| P1 | Match with blur **Off** → cams link without black veil | |
| P2 | Eye → frosted mosaic overlay (not clear video / not pure black) | |
| P3 | Show video → partner paints &lt; ~1s | |
| P4 | Settings **Hold** → next stranger starts veiled | |
| P5 | Settings blur chip saves immediately (toast, no Save required) | |
| P6 | Leave app 30s mid-call → return → video resumes | |
| P7 | Report while veiled still opens sheet | |
| P8 | Play↔PC both cams after unblur | |

```bash
cd mobile
./scripts/play-status.sh
npx tsc --noEmit
# (also covered by ./scripts/dev-smoke.sh --unit)
node scripts/test-connect-ui.mjs
node scripts/test-friend-invite.mjs
node src/live/callMetrics.test.mjs
node src/live/stageStreams.test.mjs
```

> **Note (2026-08-08 morning):** product polish lives in the **working tree** (+ overnight lands:
> history CTAs, home online strip, Open-on-PC stub, i18n overlays). Committed `main` tip may still
> lag; use `app.json` **0.1.248+** / `ruletka-latest.apk` for smoke. Next `--bump` from this WT.

## Build (local release)

```bash
cd mobile
npm install
# bump version in app.json / build.gradle if shipping
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export JAVA_HOME="${JAVA_HOME:-$HOME/.local/jdk-17}"
cd android && ./gradlew :app:assembleRelease :app:bundleRelease
cp app/build/outputs/apk/release/app-release.apk \
  ../artifacts/ruletka-<ver>-vc<code>.apk
# host:
# cp …/app-release.apk ../../ui/download/ruletka-android-latest.apk
```

Host: `ui/download/ruletka-android-latest.apk` and `ui/download/android.html`.

## Smoke matrix

| # | Test | Pass? |
|---|------|-------|
| 1 | App opens → 18+ rules → Home | |
| 2 | **What's new** card after update → dismiss | |
| 3 | Settings: language **Русский** — no mojibake | |
| 4 | Settings: name, gender, data saver, Save | |
| 5 | Live: local camera preview | |
| 6 | App ↔ web: match + A/V first try (Retry if stuck) | |
| 6b | Connect recover: soft ~3.5s / hard ~8s or Rebuild | |
| 6c | **Start** → “you are waiting” / wait count ≥1 (not stuck at 0) | |
| 6d | Meta: direct/relay · q:tier; LTE badge on cellular | |
| 6e | Wi‑Fi↔LTE mid-call → “Network changed” + media reconnect | |
| 6f | Weak link: quality steps down (less freeze than stuck high bitrate) | |
| 7 | Connection pill / “Waiting for video” / Retry | |
| 8 | Mic / cam / Flip; **More** menu | |
| 8b | **Stop**: one tap ends chat immediately — no confirm dialog | |
| 9 | Chat (prefer P2P) + typing indicator | |
| 10 | **Debate**: invite, accept, pass, end, mic lock | |
| 11 | Mid-chat gift chips (afford → spend; can't-afford tap ≠ silent); report + block → toast + Next | |
| 11b | Gift FX: **bars** lock, **balloons** rise, **confetti** fall | |
| 11c | Soft toasts: cam on/off, partner muted-you, pass-mic, queue-joined, call-ended — auto-dismiss, no dialog | |
| 11d | **Mute single-source:** mid-match "They muted you" appears **once** only (LiveStatusBanners) — not stage + banner + bottom stack | |
| 12 | Rate sheet after long chat (no double prompt) | |
| 13 | PiP: drag, snap to corner, double-tap swap | |
| 14 | Data saver mid-call via More | |
| 15 | Alone queue: copy link + share invite | |
| 16 | Friends: add code, accept request, call, hang up | |
| 16b | **Caller** stays in call with video (auto-opens Live) | |
| 16c | Friends: search, pull refresh, block/remove ⋯ menu | |
| 16d | Friend row CTAs: **Online** dot, **Call** (green when online), **Chat** with unread badge | |
| 16e | Friend **Chat** DM + history (online/offline) | |
| 16f | Live More → speaker / earpiece | |
| 17 | Incoming friend call: **ringtone + vibe** | |
| 17b | Background: minimize, friend calls → local OS alert | |
| 18 | Missed call card on home → Friends history → Call back | |
| 19 | Settings: block list unblock; report history | |
| 20 | Settings: push register (if notifications linked) | |
| 20b | Push tap: call → Live; DM → Friends chat | |
| 21 | Backup export/import | |
| 21b | **Encrypted** import: password field **first**, then Import | |
| 21c | Wrong password → clear wrong-password message | |
| 22 | Kill network → reconnect strip recovers | |
| 23 | Deep link `ruletka://friend/CODE` | |
| 24 | Settings: hub health / switch / reconnect | |
| 25 | Settings: CSAE page + child-safety email | |
| 26 | Live: partner mute; PartnerChrome flag/tier | |
| 27 | Multi-peer: 2nd tile; tap focus; keep-PC on join | |
| 28 | Friends: recent matches Add/Report/Block | |
| 29 | Stranger clear by default (Off); Settings **Brief/Hold** → veiled → Show video | |
| 30 | Rate: ★ / Thanks / Skip | |
| 31 | please_stay locks Next ~15s | |
| 32 | Long search coach; gift unlock bar | |
| 33 | Home: code card, accept requests, trust chips | |
| 34 | Live meta tap: copy code / reconnect offline | |
| 35 | Settings long-press build line copies version | |
| 36 | **Home quiet:** invite card shows code · Share + Copy | |
| 37 | **Home busy:** green “People are waiting” → Start (2+ wait) | |
| 38 | Home status: `N online · W waiting` | |
| 39 | Live chips: **Queue → Connect → Video** while searching/connecting | |
| 40 | Friend **Accept** → “Enable call alerts?” (once) | |
| 41 | Alerts enabled → Android battery unrestricted offer (once) | |
| 42 | Alerts denied → Settings + battery tip dialog | |
| 43 | **Home code card:** tap = Share invite · long-press = Copy code | |
| 44 | `./scripts/emu-test.sh` multi-screen: home/friends/settings/live ALIVE | |

Hub default: `https://ruletka.vip`.

## Priority order for closed testers (A5)

1. **Path of gold:** 1 → **36/37** Home CTAs → **6c** queue wait → 5 → **6** phone↔browser → **39** chips → 6b → 16  
2. **Friends loop:** share invite → land → Accept → **40** alerts → **41** battery → Call  
3. **Network:** **6e** wifi↔LTE · **6d** path badge · 22 kill network  
4. **Safety:** 29 → 11 (report/block) → 25  
5. **Identity:** **21b** import → stars load from hub  
6. **Polish:** 11b gifts · 17 ring · 13 PiP  

## Play ↔ PC connect smoke (P0 — do this first)

Goal: both cameras + audio, **fast**, **one offer/answer**, **no flicker**. See `docs/CONNECTIVITY_LOCK.md` + `docs/CONNECTIVITY_SPEED_PLAN.md`.

### Manual steps (you)
1. Install latest local APK (`mobile/artifacts/ruletka-android-latest.apk`, not Expo Go).
2. Hard-refresh browser `https://ruletka.vip/live.html`.
3. Open Live on phone, wait **3s on search** (TURN warm).
4. Both sides Start **once** (same Wi‑Fi first).
5. Confirm **both** remote videos + audio within **~3–5s** (hard fail if &gt;15s).
6. Stay matched **15s without spamming Next** — no black flash after first picture.
7. Optional: Next once → rematch → still 1 offer/answer.

### Hub asserts (laptop, after the call)

```bash
cd ~/freenet-roulette
./scripts/hub-match-speed.sh 30          # threshold 2000ms
./scripts/hub-match-speed.sh 30 5000     # looser threshold
./scripts/admin-agent/run-once.sh --forensics-only
```

| Assert | Pass |
|--------|------|
| Exactly **1 offer + 1 answer** per successful match | `offers ≈ answers` in summary |
| **match_to_offer_ms &lt; 2000** (same Wi‑Fi target) | `max match_to_offer_ms` + verdict PASS |
| No offer debounce thrash | `offer drops` not &gt; offers |
| No Next spam for 15s after match | hub quiet; UI stable |

Verdict meanings from `hub-match-speed.sh`: **PASS** / **WARN** / **FAIL** / **IDLE**.

### Automated (optional, needs Chrome + release bridge)

```bash
# local two-browser pair (not Play; still validates single-offer path)
node scripts/pair-smoke.mjs
# or:
node scripts/pair-test-headless.mjs
```

Skip is OK if no Chrome/bridge — use hub asserts + manual Play↔PC above.

### Fail common causes (connect)

| Symptom | Check |
|---------|--------|
| Match, zero offers | Browser `kickSoloWebRtc` / phone `startCall`; hub forensics RED_zero_offers |
| Offers, no answers | Phone GUM/ICE hang; answer path |
| Slow match→offer | Web should offer vs Android; preview ready before match |
| Double offer thrash | callGen / offer debounce / hub `last_offer_at` |
| Black video same Wi‑Fi | Clear force_relay; host coturn; hard-refresh + new APK |

## Fail common causes

| Symptom | Check |
|---------|--------|
| No camera | Not Expo Go; permissions; native build |
| Match but black video | TURN `has_turn`; Retry; hard rebuild ~8s; browser hard-refresh |
| Slow phone↔browser | Latest APK + web `webrtc.js`; run hub-match-speed |
| Garbled Russian | Old APK — install **latest** after uninstall |
| No ringtone | Volume / DND; expo-av linked in this build |
| Offline push never arrives | Hub `ROULETTE_PUSH_WEBHOOK_URL` + Expo projectId |
| Import “password too weak” | Old APK — use **0.1.63+**; type export password **before** Import |
| Import fails encrypted | Same password as web export; or re-export plain `.json` |

## After smoke

1. Update `ui/download/ANDROID-LATEST.txt` + `android.html`  
2. Archive old APKs under `ui/download/archive/`  
3. Store screenshots if submitting (`assets/store/LISTING.md`)  
4. Play internal track: see [`PLAY_OPS.md`](PLAY_OPS.md)  
