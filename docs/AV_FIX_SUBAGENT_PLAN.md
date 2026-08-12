# AV fix plan — subagents + av-verify (same-WiFi web↔Android)

**Goal:** PC browser + Android on same Wi‑Fi → **both cams + audio ≥30s**.  
**Symptom now (2026-08-10):** offer+answer OK, `force_relay=false`, **peer_usage max_rb ~2k**, black/silent; Chrome mDNS host stripped → LAN reverse path weak without real media path.  
**Rule:** **VERIFY before any APK build.** Source of truth: `artifacts/av-verify/latest.{json,md}`.  
**Stance:** **Augmentation, not automation** (`AGENTS.md`) — human smokes and authorizes build/deploy; agents measure and propose.

Locks: `docs/CONNECTIVITY_LOCK.md` · `docs/VIDEO_PATH_LOCK.md` · `docs/SHIP_STATUS.md`

---

## 1. Subagent roles (pick **one** per loop)

| Role | Owns | Never does |
|------|------|------------|
| **diagnose** | Read scorecard + journals; write 5-line root-cause + **one** next role | Code edits, deploy, APK |
| **client-ice** | Web/Android ICE: policy=all on same-IP, host/srflx survival, answerer discipline, av_path beacons | Coturn conf thrash, dual-offer, pool bloat |
| **turn-media** | Coturn conf/unit, 437 storms, CREATE_PERM/403, peer_usage bytes | Client ICE policy flip without coturn PASS |
| **verify-only** | Run gates after human smoke / after one fix; say PASS/FAIL/WARN | Fixes, builds, “try another theory” |

Director (Grok) dispatches **exactly one** implementer role after diagnose. Human owns phone+PC smoke.

---

## 2. Exact evidence commands

Run from repo root. Agents **paste verdict + key gates** into the task note; do not invent numbers.

```bash
# Scorecard (always first / last)
./scripts/av-verify.sh --min 15
./scripts/av-verify.sh --min 10 --wait 90    # after human starts match
./scripts/av-verify.sh --min 20 --coturn     # + self-peer lock
cat artifacts/av-verify/latest.md
python3 -c "import json;print(json.load(open('artifacts/av-verify/latest.json'))['verdict'])"

# Coturn lock (any turn-media change)
./scripts/test-coturn-relay.sh

# Hub journal (diagnose / client-ice)
ssh -i ~/.ssh/ruletka_ed25519 -o IdentitiesOnly=yes root@209.38.204.153 \
  "journalctl -u roulette-bridge --since '15 min ago' --no-pager | grep -E 'solo matched|first offer|first answer|av_path|answerer|force_relay'"

# Coturn journal (diagnose / turn-media)
ssh -i ~/.ssh/ruletka_ed25519 -o IdentitiesOnly=yes root@209.38.204.153 \
  "journalctl -u coturn --since '15 min ago' --no-pager | grep -E 'peer usage|ALLOCATE|error 437|403|Forbidden|CREATE'"

# Unit lock (after hub force_relay policy touch)
./scripts/test-connectivity-lock.sh
# or: cargo test -p freenet-roulette-bridge connectivity_lock

# Optional speed / monitor (not a substitute for av-verify)
./scripts/hub-match-speed.sh 15
./scripts/connect-monitor.sh --once
```

**Human smoke (required for real verdict):** latest APK · hard-refresh `live.html` · Hide IP **off** · Start **once** both · wait **≥20s** · no Next spam.

---

## 3. Decision tree (from `latest.json`)

```
av-verify snapshot
│
├─ matches=0
│    → IDLE: human smoke first. No agent code.
│
├─ answers=0  (offers>0)
│    → client-ice: phone not answering
│       Evidence: hub first offer present, no first answer; answerer drops?
│       Fix lane: Android MediaSession answer path only.
│       Forbidden: force_relay flip, coturn conf.
│
├─ answers>0 AND (peer_usage_hot=0 OR max_rb < 5k)
│    AND last_force_relay=true
│    → turn-media first: pure TURN must carry RTP
│       ./scripts/test-coturn-relay.sh must PASS
│       external-ip=PUBLIC/PUBLIC locked; no PUBLIC-only / no VPC map
│       If coturn PASS but max_rb still tiny → client pure-relay (strip host, policy=relay)
│
├─ answers>0 AND peer_usage≈0/tiny AND last_force_relay=false  ← CURRENT same-WiFi
│    → host/srflx must carry media (TURN may stay STUN-sized)
│    │
│    ├─ av_path missing / no host selected / black both ways
│    │    → client-ice: Chrome mDNS / host strip / ICE candidate filter
│    │       Check: web offer has host or usable srflx; Android same
│    │       Check: answerer no addTrack-before-setRemote; no re-offer
│    │       Check: iceTransportPolicy=all (not relay) when force_relay=false
│    │
│    └─ av_path host path fails (beacon says failed / wrong type)
│         → client-ice: fix selected candidate / firewall / permission
│         → only if host impossible after proof: temporary force_relay=true
│            + pure relay BOTH sides + coturn PASS — not hybrid thrash
│
├─ err_437 high (>20) with tiny media
│    → turn-media: stop ALLOCATE storm (auth secret, lifetime, client re-allocate thrash)
│       client-ice only if storm is from dual PC / pool spam
│
└─ signaling OK + (max_rb≥5k OR av_path host + human frames)
     → verify-only: require human both faces; then PASS
```

**Read gates quickly**

| Gate | Meaning | Agent |
|------|---------|-------|
| FAIL answers=0 | Phone silent on signal | client-ice |
| FAIL peer_usage≈0 + force_relay=true | TURN media dead | turn-media → client pure relay |
| WARN max_rb tiny + force_relay=false | Expected if host works; FAIL if cams black | client-ice (host path) |
| WARN 437 storms | Coturn thrash | turn-media (+ stop dual PC) |
| INFO no av_path | Need beacon deploy | client-ice small add, then re-smoke |

---

## 4. Hard locks (do not reopen)

| Lock | Rule |
|------|------|
| **No dual-offer thrash** | Web preferred offerer; Android answers; answerer never re-offers &lt;30s; hub debounce ~3.5s |
| **No pool&gt;0 thrash** | Do not grow warm ICE pool / multi-PC spam to “help” same-LAN |
| **No same-IP pure thrash without proof** | Do not flip same-public-IP ↔ force_relay without: av-verify before/after + human frames |
| **No hybrid under force_relay** | force_relay=true ⇒ pure `iceTransportPolicy=relay` + strip host/srflx both sides |
| **Same public IP default** | `force_relay=false` (host P2P); hide_ip / untrusted only force relay |
| **Coturn** | host unit; `external-ip=PUBLIC/PUBLIC`; no docker primary; no allowed-peer-ip whitelist |
| **P2P only** | No SFU/LiveKit default |
| **VERIFY before APK** | `./scripts/av-verify.sh` after smoke/fix; APK only if mobile change **and** scorecard not worse |
| **One fix per loop** | One role, one hypothesis, re-verify |

---

## 5. Definition of Done

All of:

1. Human: **PC sees Android face** + **Android sees PC** + **audio both ways** ≥30s (same Wi‑Fi, Hide IP off).
2. `artifacts/av-verify/latest.json` **`verdict": "PASS"`** (window covering that smoke).
3. Gates: offers≈answers; last match `force_relay=false` for normal same-IP; no answerer-grace offer spam.
4. Media evidence: either **av_path** shows live host/srflx (or relay if hide_ip) **or** coturn `max_rb` climbing if path is TURN — not STUN-only forever while cams black.
5. Optional: `./scripts/test-coturn-relay.sh` PASS (mandatory if any coturn touch).

Not Done: “matched” UI, ICE connected without frames, headless web↔web alone, WARN with black cams.

---

## 6. Daily loop (operational)

```
0. Baseline
   human smoke (once) → ./scripts/av-verify.sh --min 15
   read latest.md  (IDLE? smoke again; else note FAIL/WARN)

1. diagnose agent (5–10 min)
   journals + latest.json → ONE branch from §3 → assign ONE role

2. One fix only
   client-ice OR turn-media (not both)
   no APK yet; UI-only / hub deploy only if that role needs it

3. Re-smoke
   human Start once both · wait 20s

4. verify-only
   ./scripts/av-verify.sh --min 10 [--coturn if turn touched]
   compare HISTORY.jsonl: worse? REVERT. better but black? next loop.
   PASS + human frames? STOP. Ship.

5. Build/deploy only when human asks
   after verify-only not worse → human: “build apk” / “deploy”
   agents do not auto-bump APK or push.sh
```


**Cadence cap:** ≤1 implementer hop / loop; ≤2 loops before human “still black?” forces diagnose re-read of locks (not another policy flip).

---

## 7. Current known state (start here)

From `artifacts/av-verify/latest.json` (2026-08-10T20:05Z):

- web↔android · **force_relay=false** · mto~0.2–0.6s · mta~1.4–1.6s  
- answers slightly &lt; offers (WARN)  
- **max_rb=2016** · **437=154** · no av_path beacons  

**First branch:** §3 same-WiFi host path (`client-ice`), not re-enabling same-IP force_relay.  
**Parallel evidence only:** diagnose 437 cause; do not change coturn unless test-coturn-relay fails or force_relay path required after host proof fails.

---

## 8. Director spawn checklist + Claude handoff

### Before every `spawn_subagent`

1. [ ] Fresh `./scripts/av-verify.sh` (or latest.json &lt;15 min old)  
2. [ ] At most **one writer**; optional parallel **read-only** diagnose/coturn-test only  
3. [ ] `capability_mode`: diagnose/verify → `read-only`; shell tests → `execute`; implement → `all`  
4. [ ] Prompt includes SCORECARD paste + LANE + OWN files + MUST NOT + DONE WHEN  
5. [ ] Prefer `resume_from` for same lane over a cold re-spawn  
6. [ ] `isolation: worktree` only if two writers must not collide  

### Plugin agents (ruletka-connect)

| Agent | Use when |
|-------|----------|
| `diagnose` | After smoke; fixed VERDICT/GATES/NEXT_ROLE output |
| `verify-only` | After a fix; worse? REVERT |
| `client-ice` | Web/Android media only (webrtc / MediaSession) |
| `turn-media` | Coturn lock / conf only |

Personas (project `.grok/personas/`): `strict-verify`, `no-thrash`.

### Claude Code (narrow depth)

Grok does not spawn Claude as a native subagent. Use Claude for **one file / one hypothesis** after scorecard:

```text
CONTEXT: <paste av_path or latest.json media lines>
TASK: <single file path + single failure mode>
MUST NOT: force_relay flip, pool>0, coturn thrash, dual-offer
DONE: <measurable framesEncoded / frames_in>
```

Then Grok runs **verify-only** / av-verify. Claude does not own deploy or APK.

### Prompt skeleton (implementer)

```text
SCORECARD: verdict=… gates=… force_relay=… frames_in=… frames_out=… max_rb=…
LANE: client-ice | turn-media
OWN: <paths>
MUST NOT: pool>0; dual-offer; unprompted APK; (other)
DONE WHEN: <measurable>
OUTPUT: 10-line report
```

---

## Quick ref

| File | Use |
|------|-----|
| `scripts/av-verify.sh` | Scorecard |
| `artifacts/av-verify/latest.{json,md}` | Agent input |
| `scripts/test-coturn-relay.sh` | TURN media lock |
| `docs/CONNECTIVITY_LOCK.md` | Frozen client/hub rules |
| `docs/VIDEO_PATH_LOCK.md` | Coturn external-ip + thrash list |
| `.grok/plugins/ruletka-connect/agents/*` | Named agent contracts |
| `.grok/personas/{strict-verify,no-thrash}.toml` | Anti-thrash personas |
