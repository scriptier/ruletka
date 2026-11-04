# L16 SFX single chime static recheck — RESULT

**Status:** COMPLETE  
**OWN:** `ui/live.js` **read-only** (no edit)  
**Date:** 2026-08-12T03:26Z  
**Prior:** L13-sfx-once-debounce shipped `MATCH_CHIME_MIN_GAP_MS=1500` + `match.mp3` prefer; pin `live.js?v=565`

## Goal
Static verify `playMatchChime` gap + `match.mp3` only (no dual-tone stack). RESULT COMPLETE. No invent multi PASS.

## Verdict (disk static)

| Check | Result | Evidence |
|-------|--------|----------|
| Gap constant | **PASS** | `MATCH_CHIME_MIN_GAP_MS = 1500` @ L15996 |
| Rate-limit state | **PASS** | `lastMatchChimeAt` @ L15995; gate `now - lastMatchChimeAt < MATCH_CHIME_MIN_GAP_MS` @ L16034–16035 |
| Prefer `sounds/match.mp3` | **PASS** | `matchChimeUrl()` → `sounds/match.mp3?v=1` @ L15999–16004; `getMatchChimeAudio()` HTMLAudio @ L16008–16021 |
| Asset on disk | **PASS** | `ui/sounds/match.mp3` present, 15165 bytes |
| No dual-tone 660+880 in match path | **PASS** | `playMatchChime` has **no** `playDebateTone` / 660+880 pair |
| Fallback policy | **PASS** | softOnce = **single** 740Hz sine only if Audio cannot be created; play() fail → silence / retry once then silence (never mp3+tones) @ L16028–16075 |
| Cache pin | **PASS** | `ui/live.html` preload + script both `live.js?v=565` |
| live.js edited this hop | **No** | Report-only; L13 already correct |

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

Doc comments on path (L16025–16028): prefer file only; if play fails after file attempt → silence (**never** stack mp3 + dual-tone).

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
Debate-only UI chime. Unrelated to match/link SFX. Frequency arrays ~6082–6093 are other UI sequences, not `playMatchChime`.

## Evidence lines (`ui/live.html`)

```text
397:  <link rel="preload" href="live.js?v=565" as="script" />
3032:  <script src="live.js?v=565" defer></script>
```

## Files touched this hop
- **None** (read-only recheck). L13 already shipped gap + single-file prefer.

## Connect risk
**None** — static SFX audit only; no WebRTC / ICE / Matched logic change.

## Deploy note (human)
- Disk pin is **`live.js?v=565`**. If prod lags, human deploy `ui/live.html` + `ui/live.js` (+ `ui/sounds/match.mp3` if missing).
- Hard-refresh; Network must show **`live.js?v=565`**.
- Smoke (human): match → one spin; double Matched within 1.5s → no second spin; prefs off → silence.
- **This hop did not curl prod** — no invent prod PASS.

## Not claimed
- No prod deploy / prod curl PASS
- No multi / blur product PASS
- No APK / Android SFX path
- No browser audio smoke PASS (static only)

## COMPLETE
Card → `tasks/grok-loop/done/`. RESULT + card in done/.
