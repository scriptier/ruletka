---
title: Next / Stop roll stays matching
date: 2026-08-17
status: active
---

# Spec — Next / Stop / connect roll

## Goal
Android + browser both searching or matching: **Next** (and **Stop**) must not leave one side torn down while the hub still thinks they are matched. Rolling conversationalists stays consistent after 3+ Next.

## Symptom (human)
Both looking for a conversationalist. Browser Next ~3 times “to see if it will reconnect” → then it **stopped connecting**.

## Cause (measured)
- Hub `MATCH_SETTLE_SECS = 12` refuses Spin/Next while `Phase::Matched` (`refuse_if_match_settling`).
- Web `nextGraceUntil` is **2.5s** (5s if `force_relay`).
- `btn-next` **`closeAllPeers` then `send(next)`**.
- If Next is after client grace but inside hub 12s: client has no PC, hub still Matched, Android still waiting → **dead roll**.
- av-verify `2036Z`: live pair product frames **and** leftover android `ice=new` `zero_f_*` 0/0.

## OWN this hop
- `ui/live.js` — Next/Stop teardown vs hub ack
- Optional later: `mobile/app/live.tsx` grace lockstep (no APK this hop)

## Must not
- `MediaSession.ts` · pool>0 · force_relay flip · remount hunt RTC · APK · `push.sh`

## DONE WHEN
1. Client Next grace ≥ hub settle (12s) so the button cannot tear first.
2. Next sends hub **before** tearing PCs; tear only on “searching again” / waiting (or explicit Next ok).
3. Refuse status (`connecting — wait Ns`) does **not** leave a torn client.
4. Unit/guard test for grace + tear-after-ack.
5. `av-verify` not worse. **No invent product.ok.** Human smoke: Next 4× after faces land.

## EVAL
- `node ui/next-stop-roll.test.mjs`
- `./scripts/av-verify.sh --min 8`
- Human: hard-refresh 726; match; wait for faces; Next 4 times — each hop links.
