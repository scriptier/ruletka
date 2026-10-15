# L20 SFX chime static — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` **read-only** (no edit)  
**Date:** 2026-08-12  
**Prior:** L13 shipped gap + `match.mp3` prefer; L16 static recheck @ pin **565**; disk tip now **live.js?v=566** (L18 stamp)

## Goal
Read-only static verify `playMatchChime` gap + `match.mp3` prefer on pin `live.js?v=566`. RESULT COMPLETE. No invent multi PASS.

## Verdict (disk static)

| Check | Result | Evidence |
|-------|--------|----------|
| Gap constant | **PASS** | `MATCH_CHIME_MIN_GAP_MS = 1500` @ `ui/live.js` L15996 |
| Rate-limit state | **PASS** | `lastMatchChimeAt` @ L15995; gate `now - lastMatchChimeAt < MATCH_CHIME_MIN_GAP_MS` @ L16034–16035 |
| Prefer `sounds/match.mp3` | **PASS** | `matchChimeUrl()` → `sounds/match.mp3?v=1` @ L15999–16004; `getMatchChimeAudio()` HTMLAudio @ L16008–16021 |
| Asset on disk | **PASS** | `ui/sounds/match.mp3` present, **15165** bytes (md5 `b858bc2e622f3c051e0958baa0c3043a`) |
| No dual-tone stack in match path | **PASS** | `playMatchChime` has **no** `playDebateTone` / 660+880 pair; fail-after-mp3 → silence / one retry then silence |
| softOnce fallback | **PASS** | single 740Hz sine **only** when `Audio` cannot be created; never after successful mp3 start @ L16036–16075 |
| Cache pin | **PASS** | `ui/live.html` preload + script both **`live.js?v=566`** |
| live.js edited this hop | **No** | Report-only; L13 body still correct under 566 pin |

## Evidence lines (`ui/live.js`)

```text
15992:/** Cached match-link chime (spin.mp3 → ui/sounds/match.mp3). */
15995:let lastMatchChimeAt = 0;
15996:const MATCH_CHIME_MIN_GAP_MS = 1500;
16001:    return new URL("sounds/match.mp3?v=1", location.href).href;
16003:    return "sounds/match.mp3?v=1";
16030:function playMatchChime() {
16034:  if (now - lastMatchChimeAt < MATCH_CHIME_MIN_GAP_MS) return;
16035:  lastMatchChimeAt = now;
16037:  const softOnce = () => {
16038:    playToneSequence([
16039:      { f: 740, t: 0, d: 0.1, type: "sine", gain: 0.09 },
```

Doc policy (L16025–16028): prefer file only; if play fails after file attempt → silence (**never** stack mp3 + dual-tone).

### Callers (all go through gated `playMatchChime`)
| Line | Context |
|------|---------|
| ~25908 | `handleMatched` — new conversationalist link |
| ~30204 | Friend request Accept click |
| ~30210 | Friend request inbound toast show |
| ~30295 | Friend accepted toast |

### 660+880 — not match path
```text
30920:function playDebateTurnChime() {
30922:  playDebateTone(660, 90, 0.045, 0);
30923:  playDebateTone(880, 110, 0.04, 90);
```
Debate-only UI chime. Unrelated to match/link SFX.

## Evidence lines (`ui/live.html`)

```text
397:  <link rel="preload" href="live.js?v=566" as="script" />
3032:  <script src="live.js?v=566" defer></script>
```

## Files touched this hop
- **None** (read-only recheck). Pin moved 565→566 via L18 stamp; SFX body unchanged since L13.

## Connect risk
**None** — static SFX audit only; no WebRTC / ICE / Matched logic change.

## Deploy note (human)
- Disk pin is **`live.js?v=566`**. If prod lags, human deploy `ui/live.html` + `ui/live.js` (+ `ui/sounds/match.mp3` if missing).
- Hard-refresh; Network must show **`live.js?v=566`**.
- Smoke (human): match → one spin; double Matched within 1.5s → no second spin; prefs off → silence.
- **This hop did not curl prod** — no invent prod PASS.

## Not claimed
- No prod deploy / prod curl PASS
- No multi / blur product PASS
- No APK / Android SFX path
- No browser audio smoke PASS (static only)

## COMPLETE
Card → `tasks/grok-loop/done/`. RESULT + card in done/.
