# Polish now (connect path frozen)

**Baseline:** CONNECTIVITY_LOCK — APK **0.1.126**, web deploy with P2P outbound fix.  
**Rule:** Polish PRs must **not** change offer/answer/ICE/kickSolo/startCall/force_relay/coturn unless a smoke proves a 1-line bug.

## Recommended order

| # | Work | Why | Risk to connect |
|---|------|-----|-----------------|
| 1 | **Live chrome polish** — connecting labels, conn pill, empty stage, Next grace copy | Daily feel | Low |
| 2 | **Cam mute parity** — web Hide vs Android track-off: same labels/tooltips | Matrix P2 | Low (copy only first) |
| 3 | **Friend call UX** — ring / cancel / miss toast parity | Matrix + roadmap X3 | Low if no WebRTC churn |
| 4 | **Settings / veil copy** — all overlay langs for blur modes | Clarity | None |
| 5 | **Play store listing** — screenshots, EN/RU, data safety | Store path | None |
| 6 | **Web friend-call notif** (tab open only → improve) | Matrix P1 | None if not media |
| 7 | Prefer-direct on Android | Matrix P3 | Medium — defer |

## Explicitly later

- SFU/LiveKit  
- Lottie gifts, multi-hub stars  
- Always-on force_relay experiments  

## Smoke after every polish ship

Still run CONNECTIVITY_LOCK smoke once (both cams) before calling the build good.
