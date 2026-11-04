# Spec: Android tap-a-face partner actions (1v1 + 3-way)

**Status:** human-ok · 2026-08-15 · APK **0.1.408/vc416** · not MULTI_PASS
**Parity:** browser 3rd-tile menu (`live.js?v=656` on prod).  
**Human:** tap partner in 1v1 → actions; in 3-way tap each face → **that** person's actions.

## GOAL

Phone matches PC: tap a conversationalist → mute / blur / friend / gifts / report for **that** person.

## DONE WHEN

1. **1v1:** tap partner video (not only bottom ⋯) opens the action sheet for the first person.
2. **3-way:** tap top/first tile → first person; tap extra tile → extra person (name in sheet title).
3. Extra sheet: **no** Find 3rd / debate / browse-together. Report/block extra **keeps the pair** (drop extra only).
4. First VideoView `key="live-first-remote"` stays mounted. No hunt remount. No MediaSession ICE.
5. EVAL: `node mobile/src/live/matchContinuity.test.mjs` · `node mobile/scripts/verify-match-ux.mjs`

## MUST NOT

MediaSession.ts · webrtc.js · pool>0 · force_relay · APK (director later) · invent MULTI_PASS · remount RTC

## Lanes

| Who | Lane | OWN |
|-----|------|-----|
| Grok | p-cont | `mobile/src/live/matchContinuity.ts` |
| Grok | p-stage | `mobile/src/live/LiveStageVideo.tsx` |
| Grok | p-sheet | `mobile/src/live/LiveMoreSheet.tsx` |
| Grok | p-live | `mobile/app/live.tsx` |
| Grok | p-wiki | `knowledge/specs/2026-08-15-android-partner-actions.md` `knowledge/wiki/now.md` `knowledge/wiki/log.md` |
| Claude | i18n | `mobile/src/i18n/**` only |
| Claude | verify | `mobile/scripts/verify-match-ux.mjs` only |
| Claude | critic | read-only RESULT |

## Slot

`actionSlot`: `"primary"` \| `"extra0"` \| `"extra1"`.  
`extraPartnerActionTarget({ extras, slot })` → userId/peerId/name or null.
