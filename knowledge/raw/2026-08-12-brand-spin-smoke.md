# Raw: brand spin human smoke checklist (P5)

**Date:** 2026-08-12  
**Spec:** `knowledge/specs/BRAND-SPIN-IMPROVE-PLAN.md` **P5**  
**Skill:** `brand-stage`  
**Disk pin (re-read `ui/live.html`):** **`live-brand.css?v=16`**  
**Stack on disk:** P0 feel · P1 breath · P2 enter flourish · P3 glass/theme  
**Status:** checklist only — **no human PASS / GOAL_MET invented**

Sources:
- `tasks/grok-loop/done/BRAND-P0-spin-feel-RESULT.md`
- `tasks/grok-loop/done/BRAND-P1-idle-breath-RESULT.md`
- `tasks/grok-loop/done/BRAND-P2-enter-flourish-RESULT.md`
- `tasks/grok-loop/done/BRAND-P3-glass-theme-RESULT.md`

---

## Preflight

- [ ] Hard-refresh live (cache bust)
- [ ] Network → **`live-brand.css?v=16`** (must match `ui/live.html`)
- [ ] Theme starts on **dark** (default glass)

## Core gate + place

- [ ] Start match (or friend call) → `main.stage` gets **`has-brand-live`**
- [ ] Center seam pill visible between partner \| you (duo ~50%; trio ~33.333%)
- [ ] Full vertical **`ruletka.me`** readable — no clip
- [ ] Tile `.stage-wm` **hidden** (no dual corner mark)
- [ ] Hangup / leave match → **`has-brand-live` clears**; spin stops

## Enter flourish (P2)

- [ ] On match-link: one faster intro 360° (~**1.0s**) + pop (mid scale ~1.18)
- [ ] Then hands off cleanly into long loop (no snap / freeze)

## Soft spin cycle (P0) ~15s

- [ ] After flourish: soft **360°** about every **~15s** (cycle **16.2s**)
- [ ] Spin phase ~**1.9s** with mid scale **~1.16** + soft glow peak
- [ ] Majority time upright rest (not constant spin)

## Hold breath (P1)

- [ ] Between spins: subtle opacity / halo inhale–exhale (not dead flat)
- [ ] Hold stays upright — no second spin or scale thrash

## Reduced motion

- [ ] `prefers-reduced-motion: reduce` → **static upright** (no spin / flourish)
- [ ] Theme glass still applies when static

## Themes (P3 glass)

| Theme | Expect | OK? |
|-------|--------|-----|
| **dark** (default) | denser glass · brand-blue rim · bright wordmark | [ ] |
| **light** | frost plate · dark ink wordmark · cool blue rim | [ ] |
| **pink** | blush plate · rose rim · rose-ink wordmark | [ ] |
| **matrix** | green rim / mint wordmark | [ ] |
| **saloon** | gold rim / cream wordmark | [ ] |

## Out of scope (do not FAIL brand on these)

- Multi layout place regressions → P4 / multi-party-stage
- A/V black cams / ICE → av-fix-loop
- MediaSession / match chime tone → not this checklist
- Prod/CDN lag vs disk pin → deploy residual (human)

## Record (human only)

```
DATE:
PIN_SEEN: live-brand.css?v=
has-brand-live: yes|no
enter_flourish: yes|no|n/a
spin_~15s: yes|no
hold_breath: yes|no
reduced_motion_static: yes|no
themes dark/light/pink/matrix/saloon: pass|fail notes
PASS_SPIN_FEEL: yes|no   # only human after real browser
GOAL_MET: yes|no         # only human
notes:
```

**Agent rule:** leave PASS / GOAL_MET blank until human fills them. Do not invent.
