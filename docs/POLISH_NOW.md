# Polish now (connect path frozen)

**Baseline:** CONNECTIVITY_LOCK — APK **0.1.128+**, web speed + mute notify.  
**Rule:** Polish PRs must **not** change offer/answer/ICE/kickSolo/startCall/force_relay/coturn unless a smoke proves a 1-line bug.

## Done

| Work | Notes |
|------|--------|
| Live stage chrome | Next grace countdown, conn pill elapsed, empty-stage copy, EN/RU |
| Friend call UX | No-answer Call back, cancel/end toasts |
| Cam / Hide copy | Mobile cam pause vs web Hide black canvas |
| Partner mute notify | P2P same visuals both ways |
| Connect speed thrash | 0.1.128 + mid-offer teardown / late phone promote |

## Remaining

| # | Work | Why |
|---|------|-----|
| 1 | **i18n sweep** — new strings beyond EN/RU | Clarity |
| 2 | **Play store listing** — screenshots, EN/RU, data safety | Store path |
| 3 | **Web friend-call notif** | Matrix P1 |
| 4 | **Identity export align** | Small security parity |
| 5 | Prefer Direct on Android | Defer |

## Parked

SFU/LiveKit, Lottie gifts, multi-hub stars.

## Smoke after polish

CONNECTIVITY_LOCK smoke once (both cams) before calling a build good.
