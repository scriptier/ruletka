# Spec: Hunt holds first face

**Status:** active · 2026-08-15 · interview  
**Tip:** APK **0.1.402 / vc410** · `live.js?v=650` · `webrtc.js?v=331`  
**no MULTI_PASS / no product.ok invent**

```text
GOAL: After Let's go / looking for a 3rd, the first conversationalist
      stays live on phone and PC. Still 2 tiles. Toast/status only.

DONE WHEN (human — agents do not invent PASS):
  1) 1v1 both cams still work (HARD LOCK).
  2) Android Let's go: first face stays moving on the phone.
     Not Start. Not "Looking / first in line" solo queue.
  3) PC Courtier stays moving (not last-frame freeze).
  4) Still 2 tiles until a 3rd person is listed.

EVAL:
  - Human: faces moving ≥20s after Let's go
  - Phone phase stays matched (not search idle)
  - PC stage-duo, tile-third hidden, #remote tracks live + videoWidth>0
  - av-verify leftover 1v1 product.ok is NOT this gate

CHECKPOINTS:
  - 402 human: Let's go no longer freezes PC. Phone+PC first face OK.
    Residual: laptop does not show camera the same as PC.
  - Next hop is NOT hunt remount (402). Next is laptop inbound
    only if hunt still holds on a second Let's go.

OUT OF SCOPE until hunt DONE WHEN holds twice:
  - 4-way · SFU · webrtc.js · pool>0 · force_relay flip · Play upload

VERIFY:
  - Baseline: 401 FAIL (solo queue 054049Z + frozen Courtier)
  - After: human Let's go on 402
  - Second critic: none unless laptop hop starts

LANE: hunt-keep (done on 402) · next only if residual is laptop inbound
OWN FILES (next, if laptop): ui/live.js only unless new m-line
MUST NOT: remount Live on Matched · startCall primary on hunt ·
          second GUM · invent MULTI_PASS
MAX HOPS: 1 without new smoke
```

### Interview (2026-08-15)

| Q | Answer |
|---|--------|
| Stop when? | **Hunt holds first face** |
| 402 smoke? | **Progress.** Let's go did **not** freeze. PC video correct. Laptop sees PC + blur works. Laptop does **not** show camera the way PC does. |
| Out of scope? | Do whatever gets faces (APK ok if Android must change) |

### Residual (not hunt FAIL)

Laptop browser: sees PC (blur ok) but camera display ≠ PC. Could be:

1. Laptop does not show **Android / Courtier** (inbound missing)
2. Laptop has **no self cam tile** / no-cam cylinder (honest if no camera)
3. Laptop Hide/blur on self vs partner mismatch

Do **not** treat this as 401 remount. Measure laptop `#remote` / `#local` / no-cam before a hop.

### Status

- Hunt first face: **human progress on 402** — not MULTI_PASS
- 1v1: keep
- Laptop cam parity: **open** · one measure then one hop
