# W6 gotchas multi bullets index lint — RESULT

## Status
**COMPLETE**

## Goal
Multi gotchas **20–23** still accurate vs skill; index points multi-party wiki; fix only stale bullets.

## OWN
- `knowledge/wiki/gotchas.md` (read + fix stale ship tip)
- `knowledge/wiki/index.md` — link only if broken (**not broken**; no edit)

## Method
1. Read `gotchas.md` § Multi-party **20–23** + skill `.grok/skills/multi-party-stage/SKILL.md` GOTCHAS/DONE WHEN.
2. Cross-check `knowledge/wiki/multi-party.md` + code paths on disk (no product edits).
3. Verify disk ship stamps from `ui/live.html` + `mobile/app.json` + APK artifact.
4. Fix only stale ship tip; rules left intact.

## Accuracy audit (rules vs skill + code)

| # | Rule (summary) | Skill | Code evidence | Accurate? |
|---|----------------|-------|---------------|-----------|
| **20** | Same video track on 2+ PCs freezes Chrome Android; secondaries `track.clone()`; audio must not `setLocalStream(preview)` | GOTCHAS 4–5 · DONE WHEN 6 | `ui/live.js` `outboundVideoTrackForPc` / `ensureOutboundVideoClone`; `pushOutboundAudioTracks` audio-only replace (comments + path) | **Yes** |
| **21** | Mobile multi floor **low** not **min**; cap **3** opponents; secondary `keepLocal` / no `stop()` shared | GOTCHAS 6 · DONE WHEN 5–7 · media table | `applyMultiPeerOutboundQuality` mobileFloor; `webrtc.js` `mobileSafeMultiTier` min→low; `joinPeers` `strangerCount >= 3`; `MAX_EXTRA_PEERS = 3`; i18n `log.partyCap` “max 3 opponents”; MediaSession secondary close guards | **Yes** |
| **22** | Find-3rd: no `multiRemote` for hunt (RTC remount freeze); phone column mid-split; multi-audio only `nPeers ≥ 2`; PC `softKeepPartnerPaint` | GOTCHAS 1–3, 7–8 · DONE WHEN 1–5 | `LiveStageVideo` huntingThird wrap; `stageStreams` multiRemote only real 2+ remotes; `live.tsx` Matched gate `nPeers >= 2` before `setMultiPeerAudio`; `softKeepPartnerPaint` waves 0/80/250/700/1500 | **Yes** |
| **23** | Android `find_third_result` → `enterHuntingWithPartner` + keep remoteStream / phase matched; `lookingForThird` from hunt flags; PC `has-remote-feed` + hide `#remote-empty` | GOTCHAS 1b–1c · layout contracts | `live.tsx` case `find_third_result` → `enterHuntingWithPartner`; `lookingForThird={… huntingWithPartner \|\| findThirdPending}`; softKeep adds `has-remote-feed` / hides empty | **Yes** |

## Disk stamps verified

| Surface | Gotchas tip before | Disk now | Action |
|---------|-------------------|----------|--------|
| APK | **0.1.366-vc374** | `mobile/app.json` 0.1.366 / vc374 · `mobile/artifacts/ruletka-0.1.366-vc374.apk` | keep |
| `live.js` | **`?v=561`** | `ui/live.html` preload + script `?v=561` | keep |
| `webrtc.js` | (not on §22–23 tip) | `ui/live.html` `?v=315` | n/a |
| `live-stage.css` | **`?v=385`** (§23) | `ui/live.html` **`?v=386`** (W5 hunt caption) | **restamp §23** |

## What changed

### `knowledge/wiki/gotchas.md`
- Rules **20–23** content **unchanged** (still match skill + code).
- §23 ship tip only: `live-stage.css?v=385` → **`?v=386`**.
- Log line: W6 lint — rules accurate; stage tip restamp; human multi smoke open.

### `knowledge/wiki/index.md`
- **No edit.** Multi-party row link `[multi-party](multi-party.md)` valid; points multi-party wiki as required.
- (Note: index one-liner still says stage **v=385** — out of OWN “link only if broken”; not a broken link.)

## Not done (by design)
- No product code (`ui/` / `mobile/`)
- No invent multi PASS / GOAL_MET / human smoke
- No multi-party.md restamp (not OWN)
- No skill ship-tip edit (not OWN)

## Files
- `/home/drakosik/freenet-roulette/knowledge/wiki/gotchas.md`
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W6-gotchas-index-lint.md` (moved from running)
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/W6-gotchas-index-lint-RESULT.md`

## Risks
- Wiki-only; zero runtime risk.
- `multi-party.md` / skill / index may still cite stage **v=385** until a later stamp hop — gotchas §23 now matches disk.

## COMPLETE
