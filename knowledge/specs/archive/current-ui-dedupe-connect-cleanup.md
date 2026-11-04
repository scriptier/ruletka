# Spec: UI single-surface + connect cleanup (safe)

**Status:** P0 + P1-inventory **done** (herd `20260814T020528Z`); P2 still out  
**Date:** 2026-08-12 (UI A–D); **2026-08-14** herd P0 + P1 inventory  
**Goal:** Kill double/triple UI (mute-class) + plan/safe-clean linking mess without thrashing hop11/A/V.

## DONE WHEN

### UI (ship this pass)
1. **One flag** — stage flag chip OFF while PartnerIdentityDock shows partner (no dual 🇨🇦).
2. **Connect card** — status + timer + retry only; **no** name · ★ · loc (dock owns identity).
3. **Mute** — mid-stage 🔇 only; **no** mute toast on toggle; dead mute banner props cleaned or void-only.
4. **Blur** — stage soft blur + eye; Android Modal is **tap-to-peel chrome only** (no second full title stack if veil already shows CTA). Prefer thin modal.
5. **Friends offline** — **one** offline+retry CTA on Friends screen (not 3).

### Connect (this pass = inventory + safe only)
6. Inventory MediaSession/live.tsx connect paths: hop11, warm, force_relay, bindAnswer, offer/answer budgets — **document** mess map.
7. Safe cleanup only: dead comments, unused imports, duplicate log lines that don’t change behavior. **No** SDP/ICE/policy behavior change without smoke.

## EVAL
- `node mobile/scripts/test-live-units.mjs` (or project unit script) passes if present.
- Grep: no `youMutedThemToast` on mute toggle path.
- LiveStageVideo: connectCard has no partnerName/stars/loc lines.
- LiveStageVideo: showStageFlag false or gated off when dock owns flag.
- Friends: only one primary offline retry row in main list chrome.

## NON-GOALS (this pass)
- Rewrite MediaSession / hop11 budgets / force_relay policy
- APK bump (unless user asks)
- Web live.js/webrtc.js behavior thrash

## OWN lanes (non-overlapping)
| Lane | OWN | Agent |
|------|-----|-------|
| A | `mobile/src/live/LiveStageVideo.tsx` | UI stage |
| B | `mobile/app/friends.tsx` | Friends offline |
| C | `mobile/src/live/LiveStatusBanners.tsx`, `mobile/src/identity/PartnerChrome.tsx` | Dead mute chrome |
| D | `mobile/app/live.tsx` (mute toast, modal thin, prop cleanup) | Live shell |
| E | read-only: MediaSession + connect notes → `knowledge/raw/` or this spec | Explore |

## Verify-after
- Unit tests; static grep for dual-flag / mute toast; no MediaSession logic diff preferred.

## Connect mess map (Lane E) — 2026-08-12

### Critical paths (do not thrash)
- **force_relay sticky** — arm only on true; clear on hangup/Next only; never soft-retry arm pure mid-call
- **Warm PC** — no addTrack on search warm; no TURN prime under pure; reuse only if policy matches
- **bindAnswerOutbound** — await once before createAnswer; post-answer waves [200,600,1500,3000]
- **hop11 budgets** — answer pure first-relay warm 180 / cold 220; never global cap <180
- **Answerer** — never re-offer after answered; soft paint/iceRestart only

### Safe cleanup candidates (later)
| P0 | Fix stale tests to import real connectUi; dead private `attachLocalTracksFireAndForget`; demote triple console noise |
| P2 | Merge recovery waves; hop budget changes — needs product.ok smoke |

### P1 extract map (inventory 2026-08-13 — **do not split MediaSession this hop**)

Full symbol list: `knowledge/raw/2026-08-13-connect-p1-extract.md`. Dest files under `mobile/src/media/`.

| Dest | Symbols (~line) | Binding | Risk |
|------|-----------------|---------|------|
| **IceSdpUtils** `iceSdpUtils.ts` | `normalizeIceUrl` 153 · `expandIceServers` 170 · `filterIce` 190 · `preferTcpTurnFirst` 209 · `serializeIceCandidate` 226 · `isMdnsHostIceCandidate` 245 · `stripMdnsHostCandidatesFromSdp` 258 · `isRelayIceCandidate` 284 · `udpTurnOnly` 307 · `forceVideoSendrecvSdp` 324 · `offerSdpLooksPureRelay` 367 · `stripNonRelayCandidatesFromSdp` 382 · new `stripHostCandidatesFromSdp` (dup ~4119 / 5166 / 5444) | **pure** | **move-only** (retarget `offerSdpLooksPureRelay.test.mjs`) |
| **ForceRelayPolicy** `forceRelayPolicy.ts` | `desiredRelayPolicy` 1840 · `shouldStripHostCandidates` 1852 · `shouldFilterToRelayCandidates` 3944 · `isForceRelay` 1861 · **single `latchForceRelay` helper** (unify `setForceRelay` 1865 + `startCall` arm-only 2440 + `warmConnection` 2336 + `forceRelayRebuild` 1962 + `closeCall` 5769) | predicates **pure** w/ snapshot; latch **this** | predicates **move-only**; latch unify **behavior** (arm-only-on-true; keepLocal retains sticky) |
| **ForceRelayPolicy** stay in MS | `pcConfig` 1731 · `ensureRelayPolicyPc` 1787 · `setForceRelay` body 1865 · `forceRelayRebuild` 1957 | **this** | **behavior** — pool=0; no mid-answer rebuild |
| **BindOutbound** `bindOutbound.ts` | `trackUsable` 3072 | **pure** (no `this`) | **move-only** |
| **BindOutbound** later / stay | `remoteOfferMLineKinds` 3048 · `armVideoSenderEncode` 3086 · `bindAnswerOutbound` 3139 · `scheduleOutboundVideoWatch` 3432 · `pollOutboundVideo` 3709 · post-answer `[200,600,1500,3000]` 5488 | **this** | **behavior** — keep await-before-createAnswer; **clear outbound timers on closeCall** (unstored `setTimeout`s; ms-safe this hop) |
| **RelayWaitBudgets** `relayWaitBudgets.ts` | `waitForIceGatherRelayOrDone` 404 · `relayWaitBudgetMs` 3957 · `shouldWaitForFirstRelay` 3953 · offerer cap 400 @4099 · hop11 answer warm **180** / cold **220** @5402 · hybrid poll 40 @5028 · outbound watch `[600,1200,2000,3500,6000,10000]` 3436 | wait **pure**; caps named constants | **move-only** if values unchanged; hop budget change is **P2** (never global cap &lt;180) |

### Do not touch without smoke
poolSize>0, sticky clear on keepLocal, answerer promote, drop pre-answer bind await, dual MediaSession writers, hop10 sub-180 caps

### Call graph (spine)
matched → latch FR → early startCall → startPrimary often no-op → signal offer → ensureRelay → setRemote → bind → answer → watches; UI black → useAutoConnectRetry soft/hard only

Full detail: agent explore transcript Lane E 2026-08-12.

## UI lanes done (this pass)
- A LiveStageVideo: flag chip off; connect card status-only
- B friends: one offline+retry hero
- C LiveStatusBanners/PartnerChrome: mute text dead
- D live.tsx: mute toast off; thin Android blur modal
- Units: live-units OK (11); connectUi.test OK

## Herd resume 2026-08-13 (director)

| Lane | Agent | OWN | This hop |
|------|-------|-----|----------|
| **ms-safe** | grok-sub | `MediaSession.ts` only | P0 dead `attachLocalTracksFireAndForget`; store+clear outbound watch timers on `closeCall`; demote triple `[client-ice]` console |
| **tests** | Claude worktree | `connectUi.test.mjs`, `test-connect-ui.mjs` | Import **real** `connectUi` (transpile like `test-geo-localize.mjs`); lock 16s soft (kill stale 10s copy in `test-connect-ui.mjs`) |
| **ui-hold** | grok-sub | stage/friends/banners/chrome | leftover unused only; no layout rewrite |
| **p1-inventory** | grok-sub | `knowledge/raw/` + this spec P1 table | document extract map; **do not** split MediaSession this hop |
| **dead-sibs** | grok-sub | `connectRetry.ts` / `lastConnectStats.ts` / `useAutoConnectRetry.ts` | unused imports / dead comments only |

**P2 out:** no hop-budget / recovery-wave merge without product.ok smoke.  
**One writer** on `MediaSession.ts`. No APK / deploy / pool>0.
