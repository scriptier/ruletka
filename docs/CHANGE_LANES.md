# Change lanes (how we ship without breaking connect)

Pick a **lane** before coding. Gates and deploy paths differ.

---

## Lanes

| Lane | Examples | Required gates | Ship |
|------|----------|----------------|------|
| **UI chrome** | Settings layout, i18n, banners, Connection panel CSS | `./scripts/dev-smoke.sh --unit` | Web: `UI_ONLY=1 ./scripts/deploy/push.sh` · Mobile: APK bump if user-visible |
| **Product feature** | Gifts chrome, friends strip, home tips | unit + prefer pair-smoke | Mobile APK bump |
| **Media / connect** | ICE, TURN, offer/answer, RTCView, zOrder, blur surface | **`dev-smoke.sh`** + after human match **`smoke-connect.sh --hub-only`** | APK + Play↔PC human smoke; AAB only after green |
| **Hub / coturn** | bridge, turn conf, force_relay policy | forensics first; no casual Friday prod | full `./scripts/deploy/push.sh` |

**CONNECTIVITY_LOCK** applies to the **Media / connect** and **Hub** lanes: one offer, web preferred offerer, paint-once, no always-on zOrder 0.

---

## Definition of Done

- [ ] Lane named in task / PR description  
- [ ] Gates for that lane green  
- [ ] Mobile user-visible → versionCode + artifact under `mobile/artifacts/`  
- [ ] Media change → PLAY_TODAY / POLISH_NOW badge updated  
- [ ] Console upload → PLAY-INTERNAL notes file  

---

## Do not mix

| Bad | Why |
|-----|-----|
| Blur UI + TURN wait in one APK | Hard to bisect black video |
| Overnight unlimited connect edits | Use forensics-only or one RED task |
| Dual-offer “to go faster” | Causes thrash / 18s black |
| Always remount RTCView | Flicker + slow linking |

---

## Quick agent checklist

1. Name lane.  
2. Stay out of connect files unless lane is media/hub.  
3. Run `./scripts/dev-smoke.sh --unit` before claiming done.  
4. If media: do not claim green without hub glance after a real match.
