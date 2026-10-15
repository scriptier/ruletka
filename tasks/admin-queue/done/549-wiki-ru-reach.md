# Wiki: RU without VPN

## Goal
New wiki page + index + log: why RF users need VPN today, split site vs TURN, what we will NOT do.

## OWN
- `knowledge/wiki/ru-reach.md` (create)
- `knowledge/wiki/index.md` (one row)
- `knowledge/wiki/log.md` (one line)
- `knowledge/specs/2026-08-20-ru-reach.md` (already exists — cite, don’t gut DONE WHEN)

## Facts
- All of ruletka (HTML, WSS, coturn 3478 + 49160–50000) is DigitalOcean FRA `209.38.204.153` AS14061
- pair_force_relay: hide_ip OR untrusted IP OR same public IP — **not** “is Russia”
- Cross-city often force_relay=false → P2P first; DPI drops UDP → linking forever; VPN works
- CONNECTIVITY_LOCK: no force_relay=false to “help RU”; no pool>0; 480 stays
- Yandex verify file is SEO, not a bypass

## Page must include
| Symptom | Meaning | Next |
|---------|---------|------|
| Site won’t load | HTTPS/IP filtered | RU-reachable reverse proxy for HTML+WSS |
| Site loads, linking forever | TURN UDP filtered | TURNS :443 or second TURN in reachable AS |

## Must not
- live.js, webrtc.js, MediaSession, coturn.conf, deploy, APK
- Invent product.ok / “RU is fixed”

## Done
wiki page + index row. RESULT + COMPLETE
