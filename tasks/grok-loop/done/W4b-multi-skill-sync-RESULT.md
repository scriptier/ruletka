# W4b multi-party-stage skill sync — RESULT

## Status
**COMPLETE**

## Goal
Skill matches disk reality (clone, softKeep, hunt layouts, cap).

## OWN
- `.grok/skills/multi-party-stage/SKILL.md` only

## Evidence grepped (no product edits)

| Topic | Disk truth |
|-------|------------|
| **Clone** | `ui/live.js` `outboundVideoTrackForPc` / `ensureOutboundVideoClone` — always clone non-primary when `peerPcs.size≥2`. Android `MediaSession.adoptLocalStream` prefers `track.clone()` for secondary. |
| **softKeep** | `handleFindThirdResult` → local `softKeepPartnerPaint` at 0/80/250/700/1500ms; soft re-play + Courtier latch; no null-rebind. |
| **Hunt layout Android** | `lookingForThird = !remoteStream2 && !remoteStream3 && !!remoteStream && !!(huntingWithPartner \|\| findThirdPending)`; `LiveStageVideo` wraps 1v1 (`huntingThird`), column mid-split; `multiRemote` only real multi. |
| **Hunt layout PC** | `enableTrioLayout(true, { searching: true })` + brand middle `#tile-third`; partner \| looking \| you. |
| **Multi media gate** | Android: `setMultiPeerAudio` only when `nPeers >= 2` (not bare `party_browse`). |
| **Cap** | `joinPeers` maxOpponents = 3 solo strangers / 2 when party+mate; `MAX_EXTRA_PEERS = 3` in `matchPeers.ts`; i18n `log.partyCap`. |
| **Ship stamps** | APK **0.1.366-vc374** · `live.js?v=561` · `webrtc.js?v=315` · `live-stage.css?v=385` (`ui/live.html` + `mobile/app.json`) |

## Skill bullets updated (stale → disk)

1. **Ship stamps** — 0.1.364-vc372 / live.js?v=560 / stage v=383 → **0.1.366-vc374 / v=561 / v=385**.
2. **lookingForThird wire** — removed bare `matchMode === "party_browse"`; now matches live.tsx (`huntingWithPartner \|\| findThirdPending` + streams).
3. **softKeep** — named `softKeepPartnerPaint` + timer waves + Courtier latch.
4. **Cap** — solo ≤3 / party+mate ≤2 strangers; `MAX_EXTRA_PEERS=3`.
5. **Code map** — `enterHuntingWithPartner`, `matchPeers`, `MediaSession.adoptLocalStream`, `ensureOutboundVideoClone`, `mobileSafeMultiTier`.
6. **Gotcha 1c** — do not drive hunt UI from bare `party_browse`.

Unchanged (already accurate): no RTC remount for hunt, clone secondaries, multi-audio nPeers≥2, mobile quality floor low-not-min, MUST NOT / smoke checklist.

## Must not (honored)
- No product code thrash
- No deploy / APK / git push

## Files
- `/home/drakosik/freenet-roulette/.grok/skills/multi-party-stage/SKILL.md`
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W4b-multi-skill-sync-RESULT.md`

## Verify
```bash
# stamps in skill match disk
grep -n '0\.1\.366\|live\.js?v=\|softKeepPartnerPaint\|lookingForThird' \
  .grok/skills/multi-party-stage/SKILL.md | head
grep -nE 'live\.js\?v=|webrtc\.js\?v=|live-stage\.css\?v=' ui/live.html | head
jq -r '.expo.version, .expo.android.versionCode' mobile/app.json
```
