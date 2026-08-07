# Task: P2 — Android Prefer Direct **or** shared quality preset labels

## Goal
Pick **one**:
A) Port web "Prefer Direct" (STUN-only) toggle to Android settings + MediaSession pcConfig, mutually exclusive with Hide IP — **or**
B) Align quality preset labels (low/mid/high) with web copy if Prefer Direct is too risky overnight.

Prefer A if small; else B.

## Scope
- `mobile/app/settings.tsx`
- `mobile/src/media/MediaSession.ts`
- i18n strings as needed

## Done criteria
- [ ] Setting works or quality labels aligned
- [ ] Does not break Hide IP / force_relay hub path
- [ ] No deploy
