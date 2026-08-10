# Google Play store listing assets — upload map

All paths relative to `mobile/assets/store/`.

## Feature graphic * (required)

| File | Spec |
|------|------|
| **`../play-feature-1024x500.png`** | PNG, **1024 × 500**, &lt; 15 MB |

Upload this for **Feature graphic**.

**Video:** leave blank unless you have a YouTube URL (public/unlisted, no ads, not age-restricted).

---

## Phone screenshots * (required, 2–8)

Folder: **`screenshots/phone-*.png`**

| # | File | Shows |
|---|------|--------|
| 1 | `phone-01-age-gate.png` | 18+ age gate |
| 2 | `phone-02-permissions.png` | Cam/mic explanation |
| 3 | `phone-03-home.png` | Home |
| 4 | `phone-04-live-preview.png` | Live camera preview |
| 5 | `phone-05-friends.png` | Friends code + call |
| 6 | `phone-06-settings-safety.png` | Safety & delete |

- Size: **1080 × 1920** (9:16), PNG, well under 8 MB  
- Eligible for promotion (≥4 shots, ≥1080 on each side) ✓  

Upload **all 6** (or at least 4).

These are **branded UI mockups** (no real strangers’ faces) — fine for listing; you can replace later with real device captures if you want.

---

## 7-inch tablet screenshots *

Folder: **`screenshots/tablet7-*.png`**

- Size: **1920 × 1200** (16:9)  
- Upload **tablet7-01** … **tablet7-06** (or 2–8 of them)

## 10-inch tablet screenshots *

Folder: **`screenshots/tablet10-*.png`**

- Size: **2560 × 1600** (16:9)  
- Upload **tablet10-01** … **tablet10-06**

---

## Optional (can leave empty)

| Field | Action |
|-------|--------|
| Phone / feature **video** | Skip unless you have YouTube |
| Chromebook screenshots | Optional — skip for phone-first app |
| Android XR | Skip |
| Spatial XR video | Skip |

---

## Absolute paths (this machine)

```text
Feature:  .../mobile/assets/store/play-feature-1024x500.png
Phones:   .../mobile/assets/store/screenshots/phone-0*.png
7" tabs:  .../mobile/assets/store/screenshots/tablet7-*.png
10" tabs: .../mobile/assets/store/screenshots/tablet10-*.png
```

Regenerate:

```bash
cd mobile && python3 -c "exec(open('scripts/gen-play-screenshots.py').read())"  # if saved
# or re-run the generator script if added
```
