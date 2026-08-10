# Google Play Data safety form (draft answers)

Use while filling **App content → Data safety** in Play Console.  
Align with https://ruletka.vip/legal/privacy.html — if privacy text changes, update this file.

## Overview

| Question | Suggested answer |
|----------|------------------|
| Does your app collect or share user data? | **Yes** (networked video chat) |
| Is all data encrypted in transit? | **Yes** (HTTPS / WSS; WebRTC DTLS/SRTP) |
| Can users request deletion? | **Yes** — https://ruletka.vip/legal/delete.html + Settings |

## Data types (collect / share)

| Type | Collect? | Share? | Purpose | Notes |
|------|----------|--------|---------|-------|
| **Camera** | Yes (ephemeral stream) | Shared with **call partner** via WebRTC | App functionality | Not uploaded to hub as default storage |
| **Microphone** | Yes (ephemeral) | Shared with partner via WebRTC | App functionality | Same |
| **Photos / media** | Optional | May send to hub if user **reports** with screenshot | Safety / abuse | User-initiated report only |
| **Device or other IDs** | Yes (app-generated `user_id`) | With hub for match/friends | App functionality | On-device identity; exportable backup |
| **App interactions** | Optional analytics events | May go to analytics if enabled | Analytics | Keep minimal |
| **Crash logs** | Optional (Play Vitals / future) | Google Play | Stability | Not third-party ads |
| **Approximate location** | No (unless you add geo later) | — | — | Don’t claim if unused |
| **Contacts** | No | — | — | |
| **Financial info** | No | — | — | Stars are not money |

## Data sharing

- **Call partner:** live A/V (and optional P2P chat) during a match.  
- **Hub operator (ruletka.vip or self-host):** signaling, friends, DMs, reports, optional push token.  
- **Not sold** to data brokers / ads (declare **No** for “Data is sold”).

## Security practices

- Encryption in transit: **Yes**  
- Users can request deletion: **Yes** (web form + support email)  
- Committed to Play Families Policy: **No** (not for children; 18+)

## Sensitive permissions justification (Console)

**Camera / Microphone:** Required for peer-to-peer video chat. Preview on Live; streaming only during a call. User can deny and still browse Friends/Settings; match needs both.

**Notifications (optional):** Friend call alerts when enabled; not required for core chat.

## Reviewer / age

- Target audience: **18+ only**  
- Content rating: complete IARC → expect Mature 17+; app gate is 18+  
- No children’s features  
