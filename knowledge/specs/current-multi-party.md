# Spec: Multi-party 3-way / 4-way + cross-platform

**Status:** active · **Owner:** director + 5 subagents  
**Product:** freenet-roulette / ruletka mesh (mesh P2P, not SFU)

## Residual honesty (L90 · 2026-08-12 — stamp only; no product PASS)

L90 residual after F69 gate + BM61 plan stamp — **no invent multi PASS**. L84 web2 multi-pair = **SCAFFOLD_DONE only** (≠ MULTI_PASS). Clock this hop ~**09:47 MDT** — still **before** F70 unlock window ≥ ~10:14 MDT.

| Signal | Honest state |
|--------|----------------|
| **Multi SoftBlur device** | **OPEN / NOT claimed** — keyguard chain **F17–F69** still **BLOCKED** (PIN / AlternateBouncer / AOD·Dozing / NotificationShade) |
| **Tip APK** | **0.1.374-vc382** (F16b+; F17–F69 package reconfirm only — no install this residual) |
| **ADB serial** | **`192.168.1.94:43343`** exclusive (Pixel 9 Pro wireless) |
| **F69 last gate** | **BLOCKED COMPLETE (keyguard)** · `isKeyguardShowing=true` · `mDreamingLockscreen=true` · Dozing/AOD · trust `UNTRUSTED` · **no** Hold / multi-pair / softNative / Sink — [`BLUR-F69-multi-soft-unlock-retry-RESULT.md`](../../tasks/grok-loop/done/BLUR-F69-multi-soft-unlock-retry-RESULT.md) |
| **Plan §F stamp** | **BM61** — F1–F69; multi SoftBlur device still open — [`BM61-plan-F69-stamp-RESULT.md`](../../tasks/grok-loop/done/BM61-plan-F69-stamp-RESULT.md) |
| **Static only** | F9 / F16 / **F19s** multi SoftBlur wiring + flag **true** — **static ≠ device PASS** |
| **Harness** | **SCAFFOLD_DONE ≠ MULTI_PASS** · **≠ human multi GOAL_MET** (F17 web2phone scaffold only; F18–F69 no soft device scaffold; **L84** web2 find-3rd = SCAFFOLD_DONE only — [`L84-multi-pair-find3rd-RESULT.md`](../../tasks/grok-loop/done/L84-multi-pair-find3rd-RESULT.md); L90 multi-pair not cited as product PASS) |
| **STOP** | Do **not** spam unlock retries — `artifacts/overnight/STOP-KEYGUARD-SPAM.md` · burns F63@07:16 … **F69@09:14** · **F70 unlock recheck ≥ ~10:14 MDT** (or human unlock) · F70+ stay backlog |

**Explicit non-claims:** multi SoftBlur device **PASS** · **MULTI_PASS** · human multi **GOAL_MET** · invent F70 outcomes. Next multi soft device hop needs human unlock + Hold prefs + phone `peers≥2` + softNative/Sink per remote.

## Goal

Make **3-way and 4-way** calls reliable and more compatible across **PC Chrome/Firefox/Safari**, **Chrome Android**, **Android app**, without thrashing ICE/TURN locks.

## DONE WHEN

1. **3-way (you + 2 remotes):** local camera stays live ≥60s on Chrome Android browser after 3rd joins; partners see your face both ways.
2. **4-way (you + 3 remotes):** layout shows all remotes + local without black orphan tiles; encode budget does not freeze cam on mobile.
3. **Cross-platform:** secondary PCs never share one video `MediaStreamTrack` with primary on browsers that break (Chrome Android; prefer clone everywhere multi).
4. **No ICE thrash:** `iceCandidatePoolSize=0`; no force_relay flip; no pool growth.
5. **Human smoke** (or scorecard product.ok on 1v1 paths) before claiming fixed.

## Skip / Stop contract (3-way)

After two people accept Find 3rd and a 3rd is live:

| Who | Action | Result |
|-----|--------|--------|
| Either original pair | **Next** | Skip this 3rd; pair stays; hunt next 3rd |
| The 3rd | **Next** | 3rd searches **solo** (does not keep the pair) |
| Either original pair | **Stop** | Remaining pair member + 3rd collapse to **1v1** |
| The 3rd | **Stop** | 3rd idle; original pair hunts again |

Hub: `party_with` = pair. `your_role=party` vs `solo`. Do not treat `mode=party_browse` as “I am the pair.”

## Non-goals

- SFU / mediasoup as default
- Changing hub pure TURN policy without scorecard
- Unprompted production APK flood

## Current baseline (2026-08-12)

- Cap: `joinPeers` opponents `.slice(0, 3)` → 3v1 (4 people total: you + 3)
- UI: `#remote`, `#remote2`, `#remote-third` + local; CSS has 4-way 2×2 notes in `live-stage.css`
- Multi outbound: primary real track + secondary `track.clone()` (Chrome Android fix, live.js v554)
- Multi quality: primary mid, extras low/min; Android Chrome floors at low
- Android: `MediaSession` multiPeerAudio, track reuse for secondary PC; `stageStreams` multiRemote

## Recommended work lanes (5 agents — non-overlapping OWN)

| # | Lane | OWN files only | Focus |
|---|------|----------------|-------|
| 1 | multi-media-web | `ui/live.js` | Harden multi outbound: clones always for secondary, heal, joinPeers cap/slots for 4, quality, no mid-call GUM thrash, parallel connect already ok |
| 2 | multi-webrtc | `ui/webrtc.js` | Multi-PC encode/safety: setLocalStream never kills clones, multiFast gather, closeCall release, quality tiers mobile-safe |
| 3 | multi-layout | `ui/live-stage.css`, `ui/live.html`, optionally `ui/style.css` | 3-way + 4-way tile grid, no orphan black panes, safe remote-fourth shell if missing |
| 4 | multi-android | `mobile/src/media/MediaSession.ts`, `mobile/src/live/stageStreams.ts`, `mobile/src/live/matchPeers.ts` (read live.tsx only if bind needed) | Secondary PC track clone/reuse, multi layout streams, no dual MediaSession thrash |
| 5 | multi-compat | `knowledge/wiki/multi-party.md`, `knowledge/wiki/gotchas.md` (append), `knowledge/wiki/log.md`, `knowledge/specs/SMOKE-NEXT.md` (multi section), `ui/i18n.js` partyCap strings only | Cross-platform matrix, smoke steps, i18n “max 3 opponents” |

## EVAL

| Check | How |
|-------|-----|
| Syntax | `node --check ui/live.js ui/webrtc.js` |
| Layout | Static: 4 tiles visible with body class for 4-way |
| Media | Code review: secondary uses clone; primary uses real; audio push does not re-bind shared video |
| Android | Typecheck/build if easy; no ICE pool>0 |
| Smoke | Human 3-way Chrome Android + PC; optional 4-way |

## CHECKPOINTS

1. Spec accepted (this file)
2. Agents land in isolation / non-overlapping OWN
3. Director merge + single cache bump + deploy only if web paths change and human wants
4. Human smoke 3-way before GOAL_MET

## Risks

- Parallel `live.js` writers forbidden — only lane 1
- CSS agent must not invent JS IDs without coordinating; prefer existing `#remote-third` + CSS 2×2
- Android secondary must not `getUserMedia` a second time if primary preview live
