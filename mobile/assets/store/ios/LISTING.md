# App Store Connect listing (iOS)

Same Expo app as Play (`me.ruletka.app`). Paste into App Store Connect. Age **17+ / 18+**.  
Do not claim App Store approved.

## English

**Name:** ruletka  
**Subtitle** (≤30): `P2P video chat. 18+.`

**Promotional text** (optional, ≤170):

```
Live video chat without an account. Start to meet someone, or Call a friend by code. 18+.
```

**Keywords** (≤100 chars, comma-separated, no spaces after commas if tight):

```
video chat,roulette,webrtc,p2p,friends,random chat,adult
```

**Description:**

```
ruletka is adult (18+) peer-to-peer video chat.

Tap Start to meet a stranger, or Call a friend by code. Video goes device-to-device when possible (WebRTC). When a direct path is blocked, the hub may relay via TURN — we do not store the live video as files on our servers.

• Stranger match with live online/waiting tips
• Friends: code, chat, video Call
• Block and Report in every call
• Soft blur / hide yourself; eye to show video
• ★ reputation cosmetics (not real money, not IAP)
• No password account — identity stays on the device (encrypted export)
• English, Russian, Ukrainian, and more

You must be 18 or older. Partners can screenshot or record — never share secrets or payment details.

Safety: https://ruletka.vip/safety.html
Privacy: https://ruletka.vip/legal/privacy.html
Terms: https://ruletka.vip/legal/terms.html
Delete data: https://ruletka.vip/legal/delete.html
Child safety: https://ruletka.vip/legal/child-safety.html
Support: support@ruletka.me
```

**What’s New** (0.1.480):

```
0.1.480 — same as Android: icon-only Start/Next/Stop, Italiano + Bahasa Indonesia, 18+ P2P video.
```

## Russian (optional localization)

**Subtitle** (≤30): `Видеочат P2P. 18+.`

**Keywords:** `видеочат,рулетка,webrtc,друзья,случайный чат`

**Description:** use the RuStore full description from `mobile/assets/store/rustore/` if present; otherwise EN is enough for first submit.

## URLs

| Field | Value |
|-------|--------|
| Support URL | https://ruletka.vip/safety.html |
| Marketing URL | https://ruletka.me |
| Privacy Policy | https://ruletka.vip/legal/privacy.html |
| Support email | support@ruletka.me |
| Privacy email | privacy@ruletka.me |

## Age rating (expect 17+)

UGC live video. Frequent/Intense Mature/Suggestive themes. No 4+ / 12+.

## App Review notes (paste)

1. 18+ peer-to-peer video chat; media is WebRTC device-to-device when possible.
2. Matchmaking/signaling on our hub; Block + Report in every call.
3. No classic account — device identity + optional encrypted export.
4. Stars are free cosmetics, not IAP / real money.
5. Demo: two devices, Start → match; Friends tab for codes.
6. Encryption export: ITSAppUsesNonExemptEncryption = false (HTTPS/WebRTC only).
7. Reviewer login: none. Accept 18+ rules, grant camera+mic, tap Start.

## Human leftover

- Screenshots: 6.7" and 6.5" iPhone (iPad if `supportsTablet` stays on).
- App Privacy nutrition label (see `docs/PLAY_DATA_SAFETY.md` as the Android analog — still need iOS answers).
- `eas.json` `ascAppId` after creating the ASC app.
