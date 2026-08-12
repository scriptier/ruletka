# Wiki log (append-only)

Parse tip: `grep '^## \[' knowledge/wiki/log.md | tail -10`
## [2026-08-11] smoke | Friends 0.1.358 + av-verify WARN
- Friends device smoke PASS on Pixel: version 0.1.358/vc366; screenshots `mobile/artifacts/friends-smoke-0.1.358.png` (+ history)
- av-verify: WARN product=no-media (matches recent but frames 0/0 both sides); app_vc=366; mto~1269 mta~2704; TURN HOT
- Git: main ahead 2, huge dirty tree; COMMIT-PLAN in knowledge/specs/COMMIT-PLAN.md — no push


## [2026-08-11] compound | session brand · identity · CONNECT ban · linking gameplan · gift FX · friends polish
- **Brand:** PC center-seam `.stage-brand-spin` 360°/15s; tile `.stage-wm` hidden; Android `BrandWatermark` bottom-middle 360°/15s + `BrandLoadingLoop` idle. Corrected gotcha **§19** (was wrongly “PC bottom-middle / center seam off”). Skill `brand-stage`. Files: `ui/live-brand.css?v=10`, `BrandWatermark.tsx`, `BrandLoadingLoop.tsx`
- **Identity PC:** never paint friend_code/short_id/hex as name; hide `#remote-who-sub` 1v1; re-paint on DC `partner_identity` via `paintPartnerIdentityChrome`. Gotcha **§17**
- **CONNECT toast ban:** Android release no mid-match stopwatch toast; log + Settings Last connect (`lastConnectStats`). Gotcha **§18**. Match build chip **`__DEV__` only**
- **Linking:** paint-first + weak-belt gameplan in `linking-speed.md`; no pure-wait cuts without product.ok; residual mto/mta **not** re-invented
- **Gift FX:** PC **`live.js?v=552`** / stage **`?v=380`** **fw-v6** denser ambient CSS shells + canvas multi-wave; Android **0.1.357-vc365** denser fireworks (5 bursts, longer hold) — on disk `mobile/artifacts/`; no visual PASS without human smoke
- **Friends polish:** hub avatars + last_msg snippets + larger history thumbs + call-history avatars — APK **0.1.358-vc366**; device smoke **PASS** (artifacts/friends-smoke-0.1.358.png)
- Wiki pages: gotchas, live-chrome-ux, mobile-ux, linking-speed, index, log. **No git push/commit.** A/V product smoke still open (no-media in last window)

## [2026-08-11] skill | UX + linking session P1–P4 (docs only)
- P1: extend `mobile-match-identity` — PC+Android, poison names, paint re-paint, snug dock, no CONNECT toast
- P2: new skill `brand-stage` — center pill flip / bottom-middle / loading loop; no MediaSession thrash
- P3: gotchas **17–19** (dual id/hex, CONNECT toast ban, brand Y)
- P4: `av-fix-loop` Linking speed note (hop3/3c/6–8 ship before pure-wait cuts; GOAL_MET needs product.ok)
- No APK · no MediaSession thrash · no live.js connect logic this hop

## [2026-08-11] compound | PC chrome autohide + Android gift FX
- PC: chrome autohide restored — `live.js?v=542` 3s `scheduleHide`; `live-stage.css?v=374` all-sides hide under `html.chrome-autohide`
- Bug was force chrome-always + pin every 2s / local rail never hid
- Gotcha 15: do **not** kill autohide for “settings vanished”; keep rail only while is-chrome-open or settings sheet open
- Android: GiftFxOverlay upgrade **0.1.330-vc338** — animated heart/flowers/fireworks + soft tint + elevation; path `mobile/src/stars/GiftFxOverlay.tsx`; still not CSS-parity
- Wiki: new `live-chrome-ux.md`; mobile-ux gift FX; gotchas §15; index
- **Human smoke still pending** — no PASS invent; no ICE thrash

## [2026-08-11] compound | UX thrash + method gap + smoke retarget
- Raw: `raw/2026-08-11-ux-thrash-method-gap.md`
- Ship: APK **0.1.329-vc337**, web **live.js?v=541** hop10
- Specs: `SMOKE-NEXT`, `current-ship-ux`, `current-mobile-ux` retargeted
- Wiki: mobile-ux (dock/blur/stars rules), gotchas 9–14, index active specs
- Method: scaffold used; runtime thrash (multi-APK without smoke) — improve-system proposals pending
- **Human smoke still open** — agents idle until paste-back

## [2026-08-11] tool | pre-APK verify ladder
- Scripts: `mobile/scripts/verify-match-ux.mjs` (L0), `verify-before-apk.sh` (L0–L2)
- `build-apk-local.sh` runs verify first unless `SKIP_VERIFY=1`
- npm: `verify`, `verify:strict`, `test:match-ux`
- Wiki: `pre-apk-verify.md` — fail closed before assembleRelease
- First run: BUILD allowed (15 ok, 0 fail, 1 av-verify soft warn)

## [2026-08-10] resource | Marchese 10× Claude + skill screenshots
- Raw: `raw/2026-08-10-marchese-10x-claude.md`
- Wiki: `marchese-10x-claude.md`, `resources.md` — self-improve + skill library
- Skills: `/add-new-resource`, `/improve-system`

## [2026-08-10] schema | LLM Wiki + 3-layer method formalized
- Added `knowledge/SCHEMA.md`, ops ingest/query/lint, Always/Ask/Never in AGENTS.
- Sources: Karpathy llm-wiki pattern + Spec/Verifier/Environment method.

## [2026-08-10] compound | one-way video + client-ice hop 0.1.294
- Raw: `raw/2026-08-10-one-way-video.md`, `raw/2026-08-10-client-ice-hop-294.md`
- Scorecard ~21:04Z: signaling+TURN PASS; android frames_out=0 force_relay=0 policy=all; web frames_in=0
- Code hop: sticky hub force_relay, bindAnswerOutbound m-line, no PC rebuild mid-negotiate
- APK **0.1.294/vc302** shipped download — **smoke unverified**
- Pages: one-way-video, force-relay-same-lan, gotchas, karpathy-method, index, agent-lanes

## [2026-08-10] lint | HEALTH: OK (bootstrap)
- Index lists all wiki pages; log present; SCHEMA present.
- Gaps: post-smoke update still needed for 0.1.294; no contradiction flagged vs locks in this pass.
- Active open: human smoke for both faces.

## [2026-08-10] skill-refresh | av-fix-loop v conversation learnings
- Product FAIL vs scorecard PASS; ONE_WAY.md; dual-writer reconcile; verify-only PRODUCT fields
- Agents diagnose/client-ice/verify-only + personas updated; plugin 0.6.0

## [2026-08-10] verifiability | av-verify v3 + director/verify-after
- product.status in latest.json; one-way → WARN exit 3 (not PASS under TURN HOT)
- av-loop: PRODUCT, delta, verify-after.md, director.md, fixed agent OUTPUT contract
- plugin agent director; 0.7.0

## [2026-08-10] agentic-engineering | vibe → OS
- docs/AGENTIC_ENGINEERING.md; skills agentic-engineering + spec; agentic-check.sh
- AGENTS.md default agentic; plugin /agentic /spec; 0.8.0

## [2026-08-10] client-ice | PC black hop 0.1.295
- product scoring: do not treat web frames_out as phone receiving
- MediaSession: offer wait FR 800ms; relay budget 2200ms + restartIce; app_vc fallbacks
- agentic-loop.sh entry; APK 0.1.295-vc303 on download — smoke pending

## [2026-08-10] ingest | Marchese video 7zZy1QTvokM
- Wiki marchese-karpathy-method.md; /spec EVAL+CHECKPOINTS+interview
- AGENTS Marchese principles; director second critic; agentic-check VERIFY/EVAL

## [2026-08-10] hooks | Never walls
- .grok/hooks/never-rules.json PreToolUse: push.sh, pool>0, apk-hook install
- SessionStart agentic reminder; requires /hooks-trust
- Scorecard IDLE → NEXT_ROLE=smoke (APK 0.1.295)

## [2026-08-10] client-ice | hub_fr wipe root cause
- Live smoke app_vc=303: bind_v=1 but hub_fr=0 policy=all frames_out=0
- Root: closeCall(keepLocal) cleared sticky after setForceRelay(true)
- Fix APK **0.1.296/vc304** — keep sticky on keepLocal; offer-SDP pure belt

## [2026-08-10] client-ice | encoder dead after pure fix
- Smoke 304: hub_fr=1 policy=relay bind_v=1 but frames_out=0 bytes_out=0
- Root: RN encodings inactive / stale track after replaceTrack
- Fix APK **0.1.297/vc305** — active encodings + fresh GUM + null replace

## [2026-08-10] product.ok + skill compound + linking speed
- av-verify PASS product.ok app_vc=305 both fin/fout
- Skills: GOTCHAS 13–17, ONE_WAY layers A/B/C, wiki one-way RESOLVED
- Spec current-linking-speed: baseline mto~1.7s mta~3.8s; cap pure relay waits

## [2026-08-10] mobile-ux agents | location · stars · blur
- Three lanes: blur mosaic zOrder, partner_geo merge, PartnerChrome/gift ★ contrast
- Tests: formatLocLine, matchPeers, blurMode pass
- APK **0.1.299/vc307** download — human smoke

## [2026-08-10] smoke | SMOKE-NEXT checklist for UX 0.1.302 + speed hops

## [2026-08-10] resource | App UX thrash evidence (mute · location · stars)
- Raw: `raw/2026-08-10-screenshot-mute-loc-stars.md`
- Wiki: `resources.md` — dedicated sidecar for already-cataloged screenshot

## [2026-08-10] compound | UX hop2 + speed hop3 (APK 0.1.304)
- Raw: `raw/2026-08-10-ux-hop2-zorder-geo-blur.md`
- UX hop2: partner RTCView **zOrder 0** (chrome above SurfaceView); partner_geo 1v1 buffer always flush; mosaic force **#45536c**
- Speed hop3: web pure **850** / warmOk **500**; android answer **450** + void post-setLocal bind
- APK **0.1.304/vc312** includes UX hop2 + android speed hop3; **web UI still needs human deploy**
- Live residual pre-ship: mto **1749** mta **4097** — beat after smoke; **MUST product.ok** (no GOAL_MET without)
- Pages: mobile-ux, current-mobile-ux, current-linking-speed, SMOKE-NEXT, index
- Smoke: **pending** — no ICE thrash, no deploy this compound

## [2026-08-10] walk-loop | started (human dogs walk)
- Human away (dogs walk). Agent walk-loop active.
- Priorities: **speed + UX smoke pending** (no ICE thrash).
- Smoke APK target: **0.1.306-vc314** (`mobile/artifacts/`, latest symlink) — includes prior UX hop2 + android speed hop3 + autostart path.
- Web UI speed hop3 still needs **human deploy**.
- Specs open: `current-linking-speed`, `current-mobile-ux`; A/V Done product.ok.
- Logs: `knowledge/logs/walk-loop/log.md` + `LAST.md`

## [2026-08-10] compound | walk-loop hop3c + hop4 + autostart (0.1.308)
- Raw: `raw/2026-08-10-walk-loop-hop3c-hop4.md`
- Web hop3c: answer first-relay budgets = offer hop3 (warm 500 / pure cold second 500 flat) — `ui/webrtc.js`, **UI deploy still pending**
- Android hop4: pure offer SDP → force_relay + skip 800ms poll — **APK 0.1.308-vc316** (latest symlink)
- Autostart race fixed 0.1.307; zOrder/chrome OK (read-only recheck)
- Hub residual pre-ship still mto~1749 mta~4097; **no GOAL_MET** without product.ok
- Pages: mobile-ux, force-relay-same-lan, gotchas, index, current-linking-speed ship note
- adb: no devices; no push

## [2026-08-11] lint | HEALTH: fixed stale same-IP lock
- Contradiction: CONNECTIVITY_LOCK said NOT same-IP force_relay; code/tests/VIDEO_PATH_LOCK say same-IP pure TURN
- Applied: CONNECTIVITY_LOCK aligned; force-relay-same-lan + index + mobile-ux APK **0.1.309**
- Report: `knowledge/logs/walk-loop/health-2026-08-11.md`
- Still open: human smoke + UI deploy for speed GOAL_MET

## [2026-08-11] lint | VIDEO_PATH_LOCK pool=0 + linking-speed page
- Fixed VIDEO_PATH_LOCK stale **pool=2** → **pool=0 always** (code/webrtc ICE_CANDIDATE_POOL_SIZE=0)
- Smoke row: same-IP force_relay=true; APK ≥0.1.309
- New wiki: `linking-speed.md` (residual 1749/4097; hops unverified)
- No ICE thrash

## [2026-08-11] overnight | Pixel adb loop + 0.1.332 loc/name
- Pixel smoke: A/V OK; infinite Looking up FIXED in 0.1.332; name short-id fallback
- Raw: knowledge/raw/2026-08-11-overnight-device-loop.md
- Tools: device-smoke.sh, phone-web-pair.mjs
- APK **0.1.332-vc340** installed on Pixel

## [2026-08-11] dual-agent | Claude factory re-armed
- Skill `claude-worker`; AGENTS dual-agent section; dispatch.sh --print + bypassPermissions
- Claude 202 critic COMPLETE: PartnerBlurVeil import crash found/fixed; loc/autostart PASS
- Queue 200 unit + 201 device-smoke draining via continuous

## [2026-08-11] overnight2 | 0.1.333 watermark + hop11 + dock polish
- APK **0.1.333-vc341**: BrandWatermark center→edge animate, denser gift FX, dock contrast
- Web **live.js?v=544** hop11 denser first-3s free-stuck@550
- deploy 20260811T065619Z-hop11-wm
- device-smoke MATCHED verdict + exit4 looking-up guard

## [2026-08-11] nightly-resume | 0.1.334 + MATCHED black-remote diagnosis
- APK **0.1.334-vc342**: autostart 80/500/1200ms; fireworks −29% nodes; dock/watermark from 333
- Pixel smoke 333: MATCHED identity+watermark OK; remote black — android ice=new bind_v=0 never answered web offer (raw black-remote note)
- Web hop11 live.js?v=544 live
- Claude queue 220/221/222 pending/draining

## [2026-08-11] nightly | answerer latch fix 0.1.335
- Root: answeredAsAnswerer latched pre-setRemote → startCall skipped empty PC (black remote)
- Fix MediaSession + live signal payload coerce; APK **0.1.335-vc343**
- Smoke: see device-smoke nightly-335 / last-verdict

## [2026-08-11] nightly | 0.1.336 re-apply answerer latch after Claude harvest regression
- Harvest 223 reintroduced answeredAsAnswerer in hasRemoteSdp
- Re-fixed: real remote SDP only + offer_inflight skip; no early latch at offer ingress
- APK **0.1.336-vc344** (Pixel was offline; emu installed)

## [2026-08-11] ux | single partner identity dock 0.1.337
- Removed 3× ★ chips: stagePartnerHud off, PartnerChrome off match, one PartnerIdentityDock row (name · ★ · loc)
- displayStars precomputed max(stars,trust)
- APK **0.1.337-vc345** on Pixel

## [2026-08-11] fix | PC chrome autohide rails
- Screenshots: partner left rail + self right rail stuck visible
- Root: live.html critical CSS forced .side-rail opacity:1 !important
- Fix: hide under chrome-autohide unless is-chrome-open; deploy **live.js?v=545** stage **v=375**
