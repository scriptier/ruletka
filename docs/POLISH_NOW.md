# Polish now (connect path frozen)

**Baseline:** CONNECTIVITY_LOCK · APK via `build-apk-local.sh` · web deploy as authorized.

## Done

| Work | Notes |
|------|--------|
| Live stage chrome | Next grace, conn pill elapsed, empty copy |
| Hotkeys taller + scroll | Settings + `?` help |
| Friend call UX (mobile) | No-answer Call back, cancel/end |
| Partner mute notify | P2P same visuals |
| Connect speed thrash | mid-offer teardown / late promote |
| **APK automation** | `AGENTS.md` + post-commit hook + `build-apk-local.sh` |
| **Web friend-call notify** | Tab open+unfocused → Notification (SW push still open) |
| Overlay i18n fill | blur/mute/call keys from EN |
| Export plaintext | extra confirm (prefer password) |
| Friends CTA polish | Online dot · Call · Chat w/ unread badge |
| Mid-chat gifts | `LiveGiftBar` chip spend, can't-afford tap handled |
| Stop one-tap | immediate leave, no confirm dialog (web parity) |
| Live soft toasts | mute/pass-mic/cam/queue/call-ended, auto-dismiss |

## Remaining

| # | Work | Status |
|---|------|--------|
| 1 | **Play store listing** — screenshots, EN/RU, data safety | **Docs ready** — [`PLAY_INTERNAL_TEST_CHECKLIST.md`](PLAY_INTERNAL_TEST_CHECKLIST.md) · LISTING.md · PLAY_* · human Console upload |
| 2 | **Web push SW** — friend call when tab fully closed (`039`) | Open |
| 3 | Prefer Direct on Android (defer) | Deferred |

**Connect:** still smoke-critical after thrash fixes — hard refresh + APK 0.1.148/vc156 before Play internal.
`mobile/app.json` on `main` is still 0.1.136 — vc156 source lives only in
`backup/pre-sleep-20260808T061524Z-wip`, not yet merged; reconcile before the next `--bump`.

## Parked
SFU, Lottie gifts, multi-hub stars.
