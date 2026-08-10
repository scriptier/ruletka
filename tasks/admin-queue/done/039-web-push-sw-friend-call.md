# 039 — Web Push SW friend call (tab fully closed)

## Goal
Ring web users for friend calls when the browser tab is fully closed (not only unfocused).

## Delivered
- `ui/sw.js` — `push` + `notificationclick` handlers
- `ui/web-push.js` — PushManager subscribe + `register_push` platform=web
- `ui/live.js` — opt-in / hello_ok re-register
- Hub: `ROULETTE_VAPID_*`, `/config.json` `vapid_public_key`, native web-push crate send
- `data/vapid.env` auto-create in install-on-server.sh
- Docs: PARITY_MATRIX, POLISH_NOW, OPERATOR_NEXT, APP_LINKS

## Ops
```bash
# On hub after deploy:
ls /opt/ruletka/data/vapid.env
curl -s https://ruletka.vip/config.json | jq .vapid_public_key
```

## Smoke
1. Enable Friends call alerts on browser A
2. Fully close the tab
3. Friend B calls A → OS notification → tap opens live.html
