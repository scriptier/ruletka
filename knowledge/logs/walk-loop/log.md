# walk-loop run log (append-only)

## [2026-08-10 23:38Z] walk-loop start
TRIGGER: human dogs walk — agent walk-loop first fire
STATUS: started
PRIORITIES:
  - linking speed smoke (`current-linking-speed`) — beat residual mto 1749 / mta 4097 if possible
  - mobile UX smoke (`current-mobile-ux`) — loc · stars · blur · mute · chrome-above-video
  - product.ok gate for any GOAL_MET (no speed GOAL_MET without av-verify product.ok)
APK: **0.1.306-vc314** at `mobile/artifacts/ruletka-0.1.306-vc314.apk` (latest symlink)
RULES: no ICE thrash; no pool>0; no UI deploy without human authorize
PENDING:
  - human install + PC↔phone smoke (SMOKE-NEXT checklist)
  - web UI deploy for speed hop3 (850/500) when human back
  - knowledge compound after smoke report
NEXT: align web answer hop3 budgets if needed; verify mobile autostart; wait smoke
EOF

## [2026-08-10 23:43Z] walk-measure
ROLE: walk-measure
HUB: `./scripts/hub-match-speed.sh` (timeout 35) — **Verdict: WARN**
  - matches=3 offers=2 answers=2
  - max match_to_offer_ms=1749 (hub field); slow offers (>2000ms)=0
  - max match_to_answer_ms=4097 (hub field); slow answers=2 — over budget
  - max match_to_ice_ms=3938; slow ice (>5000ms)=0
  - android SLOW first-offers=0; offer drops=0
ADB: `adb devices -l` — **no devices** (empty list)
PUSH: skipped (no device)
APK ready (not pushed): `mobile/artifacts/ruletka-0.1.307-vc315.apk` (also ruletka-android-latest.apk → same)

## 2026-08-10T23:53:49Z
- **Hop:** knowledge-compound (no ICE thrash)
- **Raw:** knowledge/raw/2026-08-10-walk-loop-hop3c-hop4.md
- **Wiki:** mobile-ux (autostart/zOrder), force-relay-same-lan (hop4), gotchas, index, log
- **Spec:** hop4 ship marked APK 0.1.308-vc316
- **Verify:** node --check + unit tests OK; adb no devices
- **Next:** human smoke gate; do not cut more pure waits without product.ok

## 2026-08-11T00:09:11Z
- **Hop:** hop4 belt + mute dead-code (no pure-wait cut; MAX HOPS without smoke)
- **Add:** mobile/src/media/offerSdpLooksPureRelay.test.mjs (pure vs hybrid SDP)
- **Clean:** PartnerChrome dead theyMutedPill styles; LiveStageVideo PiP mute uses partnerMuteOverlay (not theyMutedMeOverlay)
- **Spec:** current-mobile-ux smoke APK → 0.1.309/vc317
- **Verify:** offerSdp + formatLocLine + matchPeers OK; node --check webrtc/live; hub IDLE; adb empty
- **Next:** human install 0.1.309 + UI deploy + product.ok; no more speed implementer hops until smoke

## 2026-08-11T00:23:24Z
- **Hop:** knowledge-health (no ICE thrash)
- **Finding:** CONNECTIVITY_LOCK stale vs pair_force_relay_decision (same-IP forces pure)
- **Fixed:** CONNECTIVITY_LOCK + wiki force-relay/index/mobile-ux APK 0.1.309
- **Report:** knowledge/logs/walk-loop/health-2026-08-11.md
- **Verify:** connectivity_lock 7/7; unit tests OK; adb empty
- **Next:** human install/smoke only; no speed implementer hops

## 2026-08-11T00:37:26Z
- **Hop:** env/docs — VIDEO_PATH_LOCK pool=0 + linking-speed wiki (no ICE thrash)
- **Why:** lock still said pool=2 under force_relay; code is pool=0 forever (437 storms)
- **Also:** knowledge/wiki/linking-speed.md + index; hub IDLE 15m; adb empty
- **Verify:** unit tests + node --check OK
- **Next:** human smoke only
