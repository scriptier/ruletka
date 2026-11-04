# Multi-party 3/4-way — Android ↔ PC cross-compatibility

**Status:** active · **Date:** 2026-08-12  
**Skill:** `multi-party-stage` · **Wiki:** `knowledge/wiki/multi-party.md`  
**Honest:** code-shipped ≠ human multi PASS · no invent GOAL_MET

## Goal

Reliable **3-way and 4-way** when any mix of:

| Side A | Side B | Side C / D |
|--------|--------|------------|
| PC Chrome | Android app | PC or Android |
| PC Chrome | Chrome Android browser | PC |
| Android app | Android app | PC |

Without freezing partner after find-3rd, black orphan tiles, or Chrome Android cam death.

## DONE WHEN (product)

1. **Find-3rd hunt (Android↔PC):** partner video keeps moving both sides ≥30s while looking pane shows.  
2. **3-way established:** all faces live ≥60s; local cam stays up on Chrome Android + app.  
3. **4-way:** all 3 remotes + local painted; no black orphan; mobile encode not frozen.  
4. **No ICE thrash:** pool=0; no force_relay flip for layout.  
5. **GOAL_MET** only after human smoke paste (or clear device evidence both directions).

## Disk tip (re-read at hop)

| Asset | Tip |
|-------|-----|
| APK | `mobile/app.json` (e.g. 0.1.373+) · SoftBlur product **ON** (`SOFT_BLUR_PRODUCT_ENABLED=true` in `SoftBlurRemote.tsx`, F10) · **1v1** soft agent evidence: **F11** Hold + **F12** Off + **F14** Intro on **0.1.371-vc379**; **F15** Hold reconfirm on post-MX **0.1.373-vc381** (`softNative=1` + Sink) · multi SoftBlur device **NOT claimed** (F9 static only; F10–F15 `peers=1`) · multi **GOAL_MET open** |
| live.js | `?v=` in live.html |
| webrtc.js | `?v=315`+ |
| live-stage.css | `?v=` in live.html |

## Priority stack (P0→P5)

| # | Action | OWN | Risk |
|---|--------|-----|------|
| **P0** | **Static audit** clone + multi-audio gate + hunt wrap on web + Android | read RESULT | none |
| **P1** | **Web multi outbound** — always clone secondaries; heal; softKeep when Android peer joins / find-3rd | `ui/live.js` only | med |
| **P2** | **Android multi** — adoptLocalStream clones; secondary closeCall keepLocal; multi-audio only nPeers≥2; hunt never multiRemote | `MediaSession.ts` · `live.tsx` (gate only) · stageStreams | med |
| **P3** | **webrtc multi safety** — setLocalStream no clone kill; mobile multi floor low | `ui/webrtc.js` | med |
| **P4** | **Layout** 3/4-way PC + Android column hunt; no orphan tiles | live-stage.css · LiveStageVideo | low |
| **P5** | **Compat matrix + SMOKE-NEXT** Android×PC matrix rows + human steps | wiki · SMOKE-NEXT | none |

## Cross-compat failure modes (target)

| Symptom | Likely layer | Lane |
|---------|--------------|------|
| Accept find-3rd → PC partner freezes | Android remount or multi-audio early | P2 |
| Accept find-3rd → Android partner freezes | PC trio rebind thrash | P1 softKeep |
| 3-way Chrome Android local cam dies | shared track 2+ PCs | P1 clone |
| 4-way black third tile | joinPeers / CSS orphan | P1 + P4 |
| Encode freeze 3–4 way mobile | min tier | P1/P3 low floor |
| Party cancel leaves multi UI | huntingWithPartner stuck | P2 live.tsx |

## Agent lanes (max 5, non-overlapping)

| ID | Lane | OWN |
|----|------|-----|
| MX1 | web multi static+fix | `ui/live.js` |
| MX2 | android multi static+fix | MediaSession · matchPeers · stageStreams · live.tsx multi gate only |
| MX3 | webrtc multi | `ui/webrtc.js` |
| MX4 | layout | live-stage.css · LiveStageVideo styles only |
| MX5 | compat docs | wiki multi-party · SMOKE-NEXT · gotchas append |

**Never same hop:** dual-write `live.js` + MediaSession.

## Smoke matrix (human)

| Scenario | Pass criteria |
|----------|----------------|
| PC offerer ↔ Android answerer → find-3rd | both faces move; hunt UI both |
| Android invite find-3rd → PC accept | PC softKeep; Android top partner live |
| 3-way PC + Android + PC | all cams ≥60s; Chrome Android local live |
| 4-way if 2 more join | 4 tiles; no black orphan |
| Chrome Android browser multi | clone path; local cam live |

## MUST NOT

- SFU default · pool>0 · force_relay thrash for layout  
- Unmount partner RTC for hunt  
- multi-audio on party_browse alone  
- SoftBlur product thrash (product flag stays **ON**; multi SoftBlur device still open — do not invent multi soft PASS)  
- Invent multi PASS  

## Log

- 2026-08-12: plan filed for user request Android×PC multi focus.
- 2026-08-12: SoftBlur tip honesty — disk tip row was stale **OFF**; source has `SOFT_BLUR_PRODUCT_ENABLED=true` (F10+) with F10–F15 **1v1** soft evidence. Multi SoftBlur device still **NOT claimed**; multi GOAL_MET still **open**. (MULTI-tip-softblur-honesty)
