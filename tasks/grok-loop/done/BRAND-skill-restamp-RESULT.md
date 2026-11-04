# BRAND-skill-restamp — RESULT

## Status
**COMPLETE**

## Goal
OWN `.grok/skills/brand-stage/SKILL.md` ship tip after brand fix: stamp
`live-brand.css?v=11`, note `live.js` `has-brand-live` wire, prod brand+sfx if known.

## OWN
- `.grok/skills/brand-stage/SKILL.md` only
- RESULT under `tasks/grok-loop/done/`
- No product / UI / mobile edits; no deploy this hop

## Disk truth (re-read before skill write)

| Pin / fact | Source | Value |
|------------|--------|--------|
| live-brand.css | `ui/live.html` L396 | **`?v=11`** |
| live.js | L397 / L3032 | **`?v=564`** |
| live-stage.css | L395 | `?v=387` (side; not brand OWN) |
| webrtc.js | L3031 | `?v=315` |
| CSS body | `ui/live-brand.css` | 8398 B · md5 **`f9fbd8295df2c202ee1bbe7ea0e10b8a`** |
| Feel contract | same | 1.55s spin · scale 1.12 mid · 16.2s cycle · `stage-brand-spin-360-loop` |
| has-brand-live wire | `ui/live.js` | `setStageBrandLive` + toggle on `main.stage` |
| Canonical call | `syncMatchChrome` | `setStageBrandLive(isLive)` lockstep with `match-live` |
| Also on | startMatchTimer / keep-PC rematch | `setStageBrandLive(true)` |
| Clear | stopMatchTimer | only when not still live |
| Match SFX | `ui/sounds/match.mp3` | 15165 B · md5 **`b858bc2e622f3c051e0958baa0c3043a`** · URL `sounds/match.mp3?v=1` |

Confirm pins:

```text
live-stage.css?v=387
live-brand.css?v=11
live.js?v=564
```

## Prod truth (curl 2026-08-12T03:05Z)

| Check | VIP | ME | Disk | Verdict |
|-------|-----|----|------|---------|
| `live-brand.css?v=` in live.html | **11** | **11** | **11** | pin match |
| brand CSS body | 8398 / `f9fbd829…` | same | same | **byte-identical** |
| `stage-brand-spin-360-loop` + 4.784/9.568 / scale 1.12 | yes | yes | yes | feel v11 live |
| `live.js?v=` | **564** | **564** | **564** | pin match |
| `setStageBrandLive` + `has-brand-live` in prod JS | present (minified) | — | present | **wire deployed** |
| `sounds/match.mp3` | 15165 / `b858bc2e…` | same | same | **sfx deployed** |
| live-stage.css | **386** | **386** | **387** | side lag only |

Bare `live-brand.css` (no `?v=`) == `?v=10` body == `?v=11` body on prod (cache bust only; server serves current file).

## What changed (skill)

1. **Ship stamps** block added after intro (multi-party pattern):
   - `live-brand.css?v=11` · `live.js?v=564` · `sounds/match.mp3?v=1`
   - Feel note: 1.55s / 16.2s / scale 1.12
2. **Prod honesty** — brand CSS + has-brand-live wire + match SFX **deployed** (curl+md5); stage 386 vs 387 noted as non-brand lag
3. **Contract** updated:
   - Cycle **~1.55s** (was ~1.2s pre–feel polish)
   - Gate `.stage.has-brand-live` + wire via `syncMatchChrome`
   - Match SFX row
4. **Source of truth** — added `live.js`, `sounds/match.mp3`; pin callout `?v=11`
5. **DONE WHEN / MUST NOT** — wire parity + no invent human spin PASS
6. **metadata.learned** → `2026-08-12`; trigger `has-brand-live`

## Prior hops (cited, not re-owned)

| Hop | Result |
|-----|--------|
| `BRAND-has-brand-live-wire-RESULT.md` | syncMatchChrome wire shipped on disk |
| `BRAND-spin-feel-polish-RESULT.md` | v=11 feel (1.55s / 1.12) on disk |
| `BRAND-prod-vs-disk-RESULT.md` | earlier lag at v=10; **superseded** by this curl (prod now v=11) |
| `SFX-match-spin-mp3-RESULT.md` | match.mp3 on disk; prod now serves it |

## Not done (by design)

- No product code edits
- No deploy / push / APK this hop
- No invent human browser PASS / GOAL_MET on spin feel
- No multi-party / stage-css OWN (387 lag)

## Files

- `/home/drakosik/freenet-roulette/.grok/skills/brand-stage/SKILL.md` (**edited**)
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/BRAND-skill-restamp.md` (card moved from running)
- `/home/drakosik/freenet-roulette/tasks/grok-loop/done/BRAND-skill-restamp-RESULT.md`
- `/home/drakosik/tasks/grok-loop/done/BRAND-skill-restamp-RESULT.md`

## Verify

```bash
grep -nE 'live-brand\.css\?v=|live\.js\?v=' ui/live.html | head
grep -nE 'Ship stamps|live-brand\.css\?v=11|has-brand-live|1\.55s|match\.mp3' \
  .grok/skills/brand-stage/SKILL.md
# prod (optional re-curl)
curl -sS 'https://ruletka.vip/live.html' | grep -E 'live-brand\.css\?v=|live\.js\?v='
md5sum ui/live-brand.css
curl -sS 'https://ruletka.vip/live-brand.css?v=11' | md5sum
md5sum ui/sounds/match.mp3
curl -sS 'https://ruletka.vip/sounds/match.mp3?v=1' | md5sum
```

Expected skill: **v=11** · **has-brand-live / setStageBrandLive** · prod brand+sfx **deployed**.

## Connect risk

**None** — skill stamp + honesty only. No ICE / MediaSession / live.js / CSS / Android media touch.

## COMPLETE

Skill ship tip restamped to disk + prod: **`live-brand.css?v=11`**, **`live.js` has-brand-live wire**, brand CSS + **match.mp3** on VIP/ME **byte-identical to disk**.
