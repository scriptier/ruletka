# Polish now

**Ship: 0.1.255 vc263 — RESTORE working partner zOrder**

```bash
adb install -r mobile/artifacts/ruletka-android-latest.apk
# 0.1.255 · 263
```

## What we broke / fixed

Human-pass baseline used partner **zOrder 1**, PiP **zOrder 2**.
Recent "chrome on top" experiments used partner **zOrder 0** → black main stage
while self PiP still worked (your screenshot on 0.1.252).

0.1.255 restores the proven stacking. Local only — not uploaded to website.

## Packages
- APK: mobile/artifacts/ruletka-0.1.255-vc263.apk
- AAB: mobile/artifacts/ruletka-0.1.255-vc263.aab
