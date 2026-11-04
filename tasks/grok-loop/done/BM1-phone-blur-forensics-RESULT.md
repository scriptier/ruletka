# BM1 Phone blur forensics — RESULT

## Status
**COMPLETE** (forensics only — no product rewrite)

## OWN
- Exclusive adb phone: Pixel 9 Pro serial **45141FDAP0004F**
- `SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=30` device-smoke
- APK on device: **0.1.366** / versionCode **374** (`me.ruletka.app`)
- **No invent multi PASS** — 1v1 MATCHED only
- **No code rewrite** this hop

## Goal
Prove whether privacy veil mounts mid-match on Pixel 0.1.366-vc374.

## Run
```bash
export ANDROID_HOME=$HOME/Android/Sdk PATH=$ANDROID_HOME/platform-tools:$PATH
adb -s 45141FDAP0004F logcat -c
cd /home/drakosik/freenet-roulette/mobile
SKIP_INSTALL=1 WEB_PAIR=1 WAIT_S=30 ./scripts/device-smoke.sh
```

| Field | Value |
|-------|--------|
| **When (ts)** | `20260812T024842Z` |
| **Device** | Pixel 9 Pro (`45141FDAP0004F`) |
| **SKIP_INSTALL** | **1** |
| **WEB_PAIR** | 1 (pid=3628969; log `web-pair-20260812T024842Z.log`) |
| **WAIT_S** | 30 |
| **Exit code** | **0** |
| **Process** | ALIVE pid=**14459** post-deeplink / final / exit-check |
| **last-verdict.txt** | **MATCHED** signals=`stop,next,report` |

## Verdict: veil mid-match

| Item | Result |
|------|--------|
| **veil_visible** | **no** |
| **blur logs present** | **partial** — only prefs load; **no** show/hide mount lines |
| **Show video / Privacy modal in UI** | **absent** in all dumps this run |
| **live-blur-btn mid-match** | content-desc **«Скрыть видео»** (Hide video) → veil **down** |
| **Partner video** | **clear** green WebPair canvas (not frosted / not covered) |

### Evidence chain (1v1 MATCHED)
1. Device-smoke classified **MATCHED** (`stop,next,report`); partner **WebPair** (log + UI).
2. Screencap **after-start** timer **0:10**: bright green partner stage fully visible; eye icon = unblurred control; **no** frosted veil / **no** “Show video” CTA.
3. Screencap **final** timer **0:15**: stage **100% green** (pixel sample of partner region); clear video; still no veil card.
4. UI dumps (`ui-after-deeplink`, `ui-after-start`, `ui-final`):  
   - **no** text/content-desc `Show video` / `Показать видео` / `Privacy`  
   - **no** blur Modal nodes  
   - only privacy-ish control: `resource-id="live-blur-btn"` desc=**«Скрыть видео»** `selected=false`
5. Logcat (smoke filter + targeted `[blur]|PartnerBlur|veil`):

```
08-11 20:49:24.794 14459 14513 I ReactNativeJS: [blur] prefs_load mode=intro
```

| Metric | Count (this hop logcat-snippet) |
|--------|----------------------------------|
| `[blur] prefs_load` | **1** (`mode=intro`) |
| `[blur] show` | **0** |
| `[blur] hide` | **0** |
| PartnerBlur / veil string | **0** |

6. Match paint still present in same snippet: `[match] name=WebPair from=dc` @ 20:49:30; ICE connected; **peers path = 1v1** (no multi claim).

### Interpretation (forensics, not a fix)
- Mid-match on this hop: privacy veil was **not** visible (UI + pixels + button label).
- Prefs say **intro**, but **no** `[blur] show why=match|stage|veil_*` fired in captured RN logcat during match settle — so either intro auto-veil never mounted, or mount logs never reached the buffer this hop. **Do not invent** “intro worked then cleared” without a show/hide pair; only **veil_visible=no** is proven for mid-match screenshots.
- Post-smoke live screencap was already **searching** (WebPair left / queue) — not used as mid-match veil evidence.
- uiautomator live re-dump after web-pair stop: `could not get idle state` (non-blocking; smoke-time dumps are authoritative).

## Paths (shots + dumps)

| Artifact | Path |
|----------|------|
| after deeplink | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024842Z-01-after-deeplink.png` |
| after start (**MATCHED**, clear video ~0:10) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024842Z-02-after-start.png` |
| final (**MATCHED**, clear video ~0:15) | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024842Z-03-final.png` |
| UI final | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024842Z-ui-final.xml` |
| UI after-start | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/20260812T024842Z-ui-after-start.xml` |
| logcat snippet | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/logcat-snippet-20260812T024842Z.txt` |
| last-verdict | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/last-verdict.txt` → **MATCHED** |
| forensics bundle | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/bm1-blur-forensics-20260812T024842Z/` |
| blur lines (canonical) | `…/bm1-blur-forensics-20260812T024842Z/logcat-blur-canonical.txt` |
| run log | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/bm1-blur-forensics-run.log` |
| web-pair log | `/home/drakosik/freenet-roulette/mobile/artifacts/device-smoke/web-pair-20260812T024842Z.log` |

## Multi
**Not claimed.** 1v1 MATCHED only. No invent multi PASS.

## Product rewrite
**None** this hop (forensics only).
