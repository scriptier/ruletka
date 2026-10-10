# Google Play app — polish plan

**Ship tip (sideload):** **0.1.386 / versionCode 394**  
**APK:** `mobile/artifacts/ruletka-0.1.386-vc394.apk` · `ruletka-latest.apk`  
**AAB for tip:** `mobile/artifacts/ruletka-0.1.386-vc394.aab` — **not** uploaded  
**Connect lock:** `CONNECTIVITY_LOCK.md`  
**Do not** regress P2P / one-offer / gifts mid-chat unlock / same-IP TURN.

> **Historical baseline:** early Internal cuts were **0.1.221–0.1.223** (vc229–231). Those are not the current tip.

## Shipped (recent)

| Area | Notes |
|------|--------|
| Same-IP video | Hub `force_relay` when public IPs match (see CONNECTIVITY_LOCK) |
| Blur | Eye on bar + full-screen soft Modal veil |
| Mute | Hub + DC; you-muted / they-muted-you banners |
| Partner card | Name · location · ★ · trust; long-press copy |
| Gifts | Mid-chat + “To {partner}” line |
| Bars gift | Visible on partner tile (Android) |
| Home | Legal footer, live tips, build badge |
| Friends | Online strip, Call / Chat, Open on PC |

## Plan (priority)

### P0 — Human now

1. Sideload smoke **0.1.386** (`PLAY_TODAY.md` / checklist)  
2. Play Console **Internal** — AAB on disk (`ruletka-0.1.386-vc394.aab`); upload is **human open**  

### P1 — After internal green

3. Closed testing countries (see `PLAY_OPS.md`)  
4. Push ring smoke (killed-app friend call)  
5. Screenshot refresh with real video if listing looks stale  

### P2 — Deferred

6. Prefer Direct Android  
7. Open-on-PC claim ticket  
8. Lottie gifts / SFU  

## Execution

- Meaningful `mobile/` change → `./scripts/build-apk-local.sh` (bump version)  
- Console → `mobile/artifacts/ruletka-0.1.386-vc394.aab` (built; not uploaded)  
- No bulk APKs on public site  
