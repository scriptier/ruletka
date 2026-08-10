# Ship status — 0.1.283 (291) · morning 2026-08-10

**Git:** `main` @ `7de3dee` · **Prod hub:** live (same-IP no force_relay) · **Web:** `webrtc.js?v=285`

## Packages

| Artifact | Path |
|----------|------|
| APK | `mobile/artifacts/ruletka-0.1.283-vc291.apk` |
| AAB | `mobile/artifacts/ruletka-0.1.283-vc291.aab` |
| Latest symlink | `mobile/artifacts/ruletka-android-latest.apk` |

## Overnight stack (ready for human smoke)

1. **Pure force_relay client** (hide_ip / untrusted only) + answerer never promotes  
2. **Android blur** — RTCView zOrder 0 + opaque mosaic (not unmount black)  
3. **Hub:** same public IP does **not** force_relay → same Wi‑Fi uses **host P2P**  
4. connectivity-lock + coturn self-peer **PASS**

## Human smoke now

```bash
export PATH="$HOME/Android/Sdk/platform-tools:$PATH"
adb install -r ~/freenet-roulette/mobile/artifacts/ruletka-0.1.283-vc291.apk
# hard-refresh https://ruletka.vip/live.html  → webrtc.js?v=285
# Hide IP off · Start once both sides · wait 15s · no Next spam
```

| Check | Pass |
|-------|------|
| Hub | `force_relay=false` · 1 web offer + 1 android answer |
| Video | PC sees phone + phone sees PC ≥30s |
| Blur | Eye → frosted mosaic · Show video restores face |
| After | `./scripts/hub-match-speed.sh 15` · `./scripts/connect-monitor.sh --once` |

## Do not regress

- Same-IP force_relay again  
- Answerer promote  
- Unmount RTCView on blur  
- Blanket web↔android force_relay  
