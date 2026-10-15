# Spec: iOS visual/UX parity with Android (Expo)

```text
GOAL: TestFlight iOS looks and behaves as close as possible to Play Android
      (same Expo app — not Swift). Safe area, Start diamond, Stop/Next idle hide,
      identity dock, blur, gifts, friends, settings.
DONE WHEN (per hop, not all at once):
  - One OWN file-set per Claude task
  - iOS-specific gaps vs Android documented in RESULT
  - No MediaSession / ICE / pool>0
EVAL: Platform.OS ios branches exist where Android has chrome; units that exist still pass
CHECKPOINTS: Human TestFlight smoke vs Pixel
OUT OF SCOPE: Swift rewrite, App Store Review submit, hub deploy, live.js web
VERIFY: grep Platform.OS; node existing tests; no invent GOAL_MET
LANE: Claude factory loop + backlog refill
MUST NOT: MediaSession.ts, ui/webrtc.js, ui/live.js, pool>0, push.sh, git push
```

**Director (Grok):** enqueue non-overlapping OWN, harvest, do not dual-write live.tsx with Claude.

**Factory:** pending → Claude; `backlog/` AUTO_REFILL keeps the loop fed.
