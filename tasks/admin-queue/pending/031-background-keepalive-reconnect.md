# Task: P1 — Play background keep-alive + reconnect banner polish

## Goal
When user leaves the app ~30s mid-call then returns, media recovers and a clear reconnect banner shows (parity with web "reconnecting" UX). Improve Android live reconnect messaging / app-state handling only if gaps found.

## Scope
- `mobile/app/live.tsx`
- `mobile/src/media/*` (only reconnect / appState paths)
- Optional small copy in i18n packs

## Done criteria
- [ ] Audit + fix gap or document "already OK" with evidence
- [ ] RESULT with connect risk
- [ ] No deploy

## Do not
- Rewrite entire WebRTC stack
