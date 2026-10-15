# Wiki/spec: linking <3s vs answers=0 FAIL

## Goal
Update linking wiki/spec so next Grok hop (after 19:00 UTC) knows **20:33Z FAIL is answers=0**, not relayWaitBudgetMs 480.

## OWN
- `knowledge/specs/current-linking-speed.md` (append a dated FAIL cite; do not change DONE WHEN to skip product.ok)
- `knowledge/wiki/linking-speed.md`
- `knowledge/wiki/log.md` (one line)

## Cite
- `knowledge/raw/20260820T203320Z-1v1-linking.md`
- gotcha **70** in `knowledge/wiki/gotchas.md`
- av-verify 20260820T203346Z: offers>0 answers=0, ice=new 0/0, force_relay=true, bind_v=0
- Do **not** cut 480. Do **not** invent product.ok.

## Must not
- live.js, webrtc.js, MediaSession.ts, deploy, APK, now.md
- force_relay=false

## Done
Spec has 20:33 FAIL as blocker for <3s GOAL_MET. RESULT + COMPLETE
