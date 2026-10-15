# Spec: 3-way hunt UI + A/V — Pixel app + 2 Chrome tabs

**Status:** Draft — interview 2026-08-14  
**Parent:** `current-multi-party.md` (code-shipped, human smoke **open**)  
**1v1:** fine (phone desk product.ok `025100Z` mto 1097 / mta 2153) — not this hop

```text
GOAL: Find-3rd looks right and the 3rd actually connects — Pixel app + 2 PC Chrome tabs.
DONE WHEN:
  1) HUNT: after Find 3rd, first partner video stays live (no remount freeze / full-screen brand).
     Looking pane is separate (PC trio | phone column mid-split).
  2) JOIN: 3rd accepted → 3 live tiles (2 remotes + you). No permanent black orphan.
  3) A/V: faces + audio all ways ≥30s (you see both, they see you).
  4) Human pastes smoke or we have artifacts/shots of all three surfaces.
EVAL:
  - ./scripts/shot.sh --label multi3 before/after accept
  - adb logcat: no RTC remount on hunt; nPeers≥2 only after accept
  - PC: partner column stays has-remote-feed during trio-searching
  - Do not invent MULTI_PASS / product.ok from WEB_PAIR 1v1 or SCAFFOLD_DONE
CHECKPOINTS:
  - You sit the smoke: Pixel + Chrome tab A (partner) + Chrome tab B (3rd)
  - APK: installed is 0.1.376/vc384 — hunt/clone are on disk; say “build apk” if you want tip on device
  - Deploy web pin (live.js 578 / stage 405) only if you authorize
SKIP / STOP (human 2026-08-14 — product contract):
  After the original two accepted Find 3rd and a 3rd is live:
  - Pair Next (either of the two): skip this 3rd, hunt the next 3rd. Teammate stays.
  - 3rd Next: 3rd leaves and searches **solo** (does not keep the pair).
  - Pair Stop (either of the two leaves): remaining teammate + 3rd collapse to **1v1**.
  - 3rd Stop: 3rd idle; original pair hunts again.
OUT OF SCOPE:
  - 4-way grid
  - SoftBlur multi tiles
  - iPhone Safari
  - SFU
  - 1v1 linking wait cuts / MediaSession hop11
VERIFY:
  - Baseline: code-shipped, human multi OPEN
  - After: human 30s 3-way + shots in artifacts/shots/
  - Second critic: optional after one implement hop
LANE: multi-party-stage (one writer per OWN)
OWN (if implement):
  - layout: live-stage.css / LiveStageVideo.tsx (non-overlap)
  - web keep: ui/live.js hunt/softKeep only
  - android hunt: live.tsx lookingForThird only — not dual MediaSession
MUST NOT: remount 1v1 RTCView on hunt; same track on 2 PCs; pool>0; invent MULTI_PASS
MAX HOPS: 2 implementers without new human 3-way paste
```

## Interview notes

- Picked “linking feels instant” then clarified: **1v1 is fine**; want **3/4-way UI + connect + signal** on Android and cross-platform.
- First win: **both** hunt UI **and** 3-way A/V. 4-way later.
- Smoke you will sit: **Pixel app + 2 PC Chrome tabs** (this desk).

## Next (need your go)

1. Measure-only: you Find 3rd; I shot + logcat + note FAIL lines.  
2. Implement only FAIL lines (non-overlapping OWN).  
3. APK only if hunt/clone missing on **0.1.376**.
