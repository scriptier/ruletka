# 033 RESULT — Chat + typing + gifts parity

**COMPLETE**

## Feature × web × android × status

| Feature | Web | Android | Status |
|---------|-----|---------|--------|
| Live chat send | P2P DC prefer, hub `chat` fallback (`live.js` sendLiveChat) | Same (`live.tsx` sendChat) | **works** |
| Live chat receive | hub `chat` + DC `chat` | hub `chat` + DC `chat` | **works** |
| Typing send | DC `typing` / `typing_stop`, ~throttle | DC same, 1200ms throttle | **works** (fixed: always `typing_stop` after send) |
| Typing receive | DC → UI indicator | DC → `peerTyping` + LiveChatOverlay | **works** |
| Gift catalog | 8 effects, costs 1/5/5/5/5/5/15/30 | `gifts.ts` same 8 + costs | **works** |
| Gift spend | hub `spend_stars` + 10s client rate limit | hub `spend_stars` — **was only 900ms guard** | **fixed** → 10s rate limit |
| Gift receive FX | star_effect → overlays | star_effect → GiftFxOverlay (bars/balloons/confetti/pass_mic + static) | **works** |
| please_stay Next lock | hub + local `selfNoSkipUntil` | hub echo + local 15s stayUntil | **works** |
| pass_mic toast | web toast | passMicToast when from other | **works** |
| Stars balance after spend | spender_stars on star_effect | HubProvider sets stars | **works** |
| Mid-chat unlock bar | star progress vs rate_min_secs | LiveGiftBar + rateMinSecs from hub | **works** |

## Fixes landed

| File | Change |
|------|--------|
| `mobile/app/live.tsx` | Gift **10s** rate limit (web `GIFT_RATE_LIMIT_MS` parity); spend via `resolvePartnerTargetId()`; typing_stop after every send |
| `mobile/src/i18n/overlay/en.json` | `mobile.live.giftRateLimit` |

## Not changed
- Gift economy / prices
- WebRTC / match path
- No bulk modular live rewrite

## Connect risk
**None** (gifts/chat only).

## Deploy
Mobile APK rebuild via automation; no web connect deploy required.
