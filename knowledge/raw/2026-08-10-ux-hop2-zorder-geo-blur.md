---
title: UX hop2 (zOrder · geo · blur) + speed hop3
date: 2026-08-10
slug: ux-hop2-zorder-geo-blur
source_type: implementer-hop
app: 0.1.304-vc312
status: code done — smoke pending (MUST product.ok)
---

# Raw: UX hop2 + linking speed hop3 (2026-08-10)

Code done. **Do not thrash ICE.** **No deploy.** Human smoke + `av-verify product.ok` required before GOAL_MET.

## APK

- **0.1.304 / vc312** — `mobile/artifacts/ruletka-0.1.304-vc312.apk`
- Includes UX hop2 **and** Android speed hop3

## UX hop2 (mobile chrome / blur / geo)

| Item | Change |
|------|--------|
| **partner zOrder** | Partner RTCView **zOrder 0** always so PartnerChrome (loc / ★ / banners) sits **above** SurfaceView |
| **partner_geo** | 1v1 buffer **always flush** on match (loose peer_id); no empty wipe of real geo |
| **mosaic** | Force base **`#45536c`** (pixel mosaic; caller transparent no longer wins) |
| **self-hide** | Partner Hide still mosaics partner tile only (from earlier hop) |

## Speed hop3

| Side | Change |
|------|--------|
| **web** | pure budget **850**; warmOk first-pass cap **500** |
| **android** | answer relay wait **450**; **void / fire-and-forget post-setLocal bind** (keep pre-createAnswer await bind) |

- Android hop3 is **in APK 0.1.304**.
- Web hop3 is **on disk only** — **UI still needs human-authorized deploy** (`webrtc.js` / related). No agent deploy.

## Live residual (before hop3 fully shipped)

| Metric | Pure web→android |
|--------|------------------|
| max mto | **1749** |
| max mta | **4097** SLOW |

Beat these after UI deploy + APK install; journal alone is not enough.

## Gate

- **MUST smoke** PC↔phone with APK 0.1.304
- **MUST** `./scripts/av-verify.sh` → **`product.status=ok`** for GOAL_MET
- No GOAL_MET on UX or speed without product.ok
- Checklist: `knowledge/specs/SMOKE-NEXT.md`

## Out of scope this hop

- ICE / force_relay / pool thrash
- UI production deploy
- Claiming PASS without human faces + scorecard
