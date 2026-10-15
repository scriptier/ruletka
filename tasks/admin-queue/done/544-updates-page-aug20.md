# Updates page — refresh 2026-08-20

## Goal
Refresh `ui/updates.html` featured **2026-08-20** block + i18n so it matches human smoke. Honest: gifts PASS; linking **not** claimed fixed.

## OWN
- `ui/updates.html` only the Latest Aug 20 section + `page.updates.updated` fallback text
- `ui/i18n/en.json` and `ui/i18n/ru.json` keys `page.updates.updated` and `page.updates.uAug20*`
- Other `ui/i18n/{ar,bg,cs,de,es,fr,pl,pt,sr,tr,uk,zh}.json` — copy EN if key missing
- **Do not** edit `ui/i18n/meta.json` or `ui/i18n/home-en.json`

## Copy (EN — keep short)
- **updated:** `Last updated: 2026-08-20 · gifts that move, tap ★, timer, Android 0.1.456`
- Title: keep “Gifts that move · tap ★” or similar
- Gifts: balloons/snow/confetti/flowers/disco/spotlight **move** (human PASS). Face stays visible.
- Tap photo/★: spend 3★ they get 1★ comet. Please stay in Partner actions.
- Live chrome: partner **timer bottom-left** (autohide). Friend **code under Trusted**. Your cam name/★ stay on.
- Android **0.1.456**: disco club, friend-request Accept/Decline, call avatars, Settings photo.
- Linking: **still** faster “I see you” in progress. Same-WiFi uses relay. **No “fixed connect” / MULTI_PASS.**

RU: translate; other langs copy EN.

## Must not
- `live.js`, `live-stage.css`, MediaSession, deploy, APK
- Invent product.ok / GOAL_MET / 3-way MULTI_PASS
- Claim linking is fixed (20:33Z FAIL answers=0)

## Done
- Featured Aug 20 block updated
- en+ru keys match
- RESULT + COMPLETE
