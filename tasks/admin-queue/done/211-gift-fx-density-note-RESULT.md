# 211 — GiftFxOverlay particle density note (read-only audit)

Status: COMPLETE

Files touched: none (read-only review)

Reviewed: `mobile/src/stars/GiftFxOverlay.tsx`

## Particle / node counts per effect layer

| Layer | Emitter | Count constant | Per-item nodes | Simultaneous animated nodes |
|---|---|---|---|---|
| `heart` | `HeartLayer` → `floatSpecs(5 emojis, 22, ...)` | `22` | 1 `Animated.Text` each | 22 + 1 `HeroPulse` = **23** |
| `flowers` | `FlowersLayer` → `floatSpecs(6 emojis, 20, ...)` | `20` | 1 `Animated.Text` each | 20 + 1 `HeroPulse` = **21** |
| `please_stay` | `PleaseStayLayer` → `floatSpecs(4 emojis, 14, ...)` | `14` | 1 `Animated.Text` each | 14 + 1 `HeroPulse` = **15** |
| `balloons` | `BalloonsLayer` → `balloonSpecs` `n = 18` | `18` | `RisingBalloon` = 3 Views (body+knot+string) + 1 Animated.View wrapper | 18 × ~4 views = **~72 view nodes** (18 animated loops) |
| `confetti` | `ConfettiLayer` → `confettiSpecs` `n = 56`, plus 7 fixed `ConfettiEmoji` | `56` + `7` | 1 Animated.View / Animated.Text each | 56 + 7 = **63** (heaviest discrete-loop count) |
| `fireworks` | `FireworksLayer` → `fireworkBursts` 5 centers, `nSparks = 12 + (bi%3)*2` (12,14,16,12,14) → sum 68 sparks + 5 cores; plus `floatSpecs(3 emojis, 10, ...)` | 5 bursts × ~13.6 avg sparks | 1 `FireworkSpark` Animated.View per spark + 1 core Animated.View per burst | 68 sparks + 5 cores + 10 floating emoji = **83** (highest total animated-node count of all effects) |
| `bars` | `BarsOverlay` | `barCount = 9` | 2 Views per column (metal + highlight) | 9 × 2 = 18 + 3 horizontal bars + frame/sheen/badge ≈ **~25**, but all static geometry, only 1–2 shared Animated.Value drivers (slam, sheen) — cheap |
| `pass_mic` | `PassMicLayer` | fixed | ~8 Animated.Text/View nodes total | **~8**, single shared timeline — cheap |
| unknown-effect fallback | `floatSpecs(3 emojis, 16, ...)` | `16` | 1 Animated.Text each | 16 + 1 `HeroPulse` = **17** |

## Notes on low-end Android load

- Each `FloatingEmoji`, `FallingConfetti`, `RisingBalloon`, and `FireworkSpark` instance runs its **own independent `Animated.loop`** (own `useEffect`, own JS-driven loop restart), not a single shared driver — so the *count* above is also roughly the count of concurrently active native-driven animation loops, each incurring its own bridge start/stop calls on loop repeat.
- `fireworks` is the heaviest path: 83 concurrently animated nodes, each with `shadowOpacity`/`shadowRadius` set on `fwCore`/`fwSpark` (shadow rendering is comparatively expensive on Android, unlike iOS where shadows are cheap layer-backed).
- `confetti` is second heaviest by raw node count (63) but avoids shadows, so likely cheaper per-node than fireworks despite the higher count.
- `balloons` (18 specs) is lighter in loop count but each balloon is a 3–4 view composite (body + shine + knot + string), so total view-tree nodes are comparable to confetti despite fewer independent Animated loops.
- `bars` and `pass_mic` are effectively fixed-geometry with shared Animated.Value drivers — negligible marginal cost regardless of screen size/density.

## Recommendation

Density on `fireworks` (83 simultaneous animated nodes, several with `shadowRadius`) is the one path worth trimming first if overnight low-end-Android profiling shows jank — no code changed here per task scope.

Verify commands run: none (read-only review, no build/test required by task).

Connect risk: none
