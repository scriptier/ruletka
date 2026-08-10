# Store marketing assets

Source art: `../icon-source.jpg` (copied from `~/Pictures/icon.jpg`).

| File | Use |
|------|-----|
| `app-icon-1024.png` | Google Play / App Store high-res icon (upload this) |
| `play-feature-1024x500.png` | Google Play feature graphic |
| `apple-touch-180.png` | Reference |

Expo app icons: `../icon.png`, `../adaptive-icon.png`, `../splash-icon.png`.

Regenerate after replacing the source:

```bash
cp ~/Pictures/icon.jpg mobile/assets/icon-source.jpg
cd mobile && python3 scripts/gen-store-assets.py
```

**Play Console:** Store listing → App icon → upload `app-icon-1024.png`.
