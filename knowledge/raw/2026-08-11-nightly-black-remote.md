# Nightly black remote — diagnosis 2026-08-11

**APK:** 0.1.333 / vc341 · Pixel 9 Pro · smoke ts `20260811T072019Z`  
**Scorecard:** `artifacts/av-verify/20260811T072402Z` · verdict=WARN · product=one-way  
**Code change this hop:** **none** (no clear single fix on paint / MediaSession without thrash)

---

## Human / smoke

| Item | Value |
|------|--------|
| Match UI | MATCHED peer `5d12e95c` · timer ≥1:45 · Stop/Report/Next OK |
| Remote UI | **black + "Linking…"** entire call |
| Local PiP | healthy |
| FATAL | none |
| partner_geo | 0 logcat hits |
| Network note | Wi‑Fi off, Koodo 5G during smoke (QS sheet noise) |

Artifacts: `mobile/artifacts/device-smoke/NIGHTLY-RESUME.md`, `nightly-resume-final.png`, `web-pair-nightly-resume.log`.

---

## Product frames (do not trust blended window)

### Phone match (the one that mattered)

| Side | id | role | force_relay | policy | ice / cs | frames_in/out | bind_v |
|------|-----|------|-------------|--------|----------|---------------|--------|
| **android** | `aec9b44a` | answerer (offerer=0) | **0** | **all** | **new / new** | **0 / 0** | **0** |
| **web** (headless pair) | `5d12e95c` | offerer | false | all | checking → **failed** | 0 / 0 | — |

Web pair log for this peer:

- `matched with aec9b44a` · `connect() promoted warm PC pure=0`
- offer sent (`offer path ms 416`, `kickSolo … emit=1`)
- `CONNECT offer=2204 answer=?` ← **no answer from phone**
- black_watch → ice disconnected; requeue after ~54s

Android av_path only three zero-frame beacons (~3.5s / 6s / 10s):

```text
why=zero_f_* force_relay=0 hub_fr=0 policy=all ice=new cs=new
sig=stable offerer=0 bind_v=0 app_vc=341 frames_*=0 enc_active=null
```

Then **silence** — no later android beacons while UI stayed MATCHED 1:45+.

### Polluting web↔web rematch (NOT the phone)

After phone path failed, headless web requeued and matched **`0c1fa9ba` ("Драконов")** — another **web** client, pure relay:

- hub: `solo matched a=0c1fa9ba b=5d12e95c … force_relay=true`
- both web · relay→relay · fin/fout ~17/23 · ok=1

This is what made scorecard look like:

```text
product one-way · web fin/fout=17/23 · android 0/0
force_relay mismatch hub=true android fr=0 policy=all
phone_to_pc=true  ← misleading (web fin from web↔web)
```

**Correct product read for Pixel:** **no-media / no negotiation**, not classic one-way (phone sees PC, PC black).

---

## Layer checklist (ONE_WAY.md)

| Layer | Verdict | Evidence |
|-------|---------|----------|
| **A pure latch** | N/A for this phone call | Phone match was **hybrid both sides** (web pure=0, android hub_fr=0). Mismatch gate is from **later web↔web pure**, not from Pixel. |
| **B bind** | FAIL | `bind_v=0` entire window — `bindAnswerOutbound` never ran after real setRemote |
| **C encoder** | N/A | Never reached encodings / frames_out recovery |
| **Paint / ontrack / zOrder** | **Not root** | ice stays `new` → no remote RTP → RTCView/zOrder hop cannot fix Linking… |

---

## Failure chain (≤5 lines)

1. Signaling MATCHED phone `aec9b44a` ↔ web `5d12e95c` (hybrid).  
2. Web sent offer; **phone never emitted answer** (`answer=?`).  
3. Android PC stays **ice=new cs=new bind_v=0** while outbound zero_f watchdog runs (startCall answerer path armed).  
4. Web ICE fails; phone UI remains MATCHED + Linking… (stale match chrome).  
5. Concurrent web↔web pure match **poisons** av-verify product (one-way / fr_mismatch / web frames).

---

## Why not a one-hop code fix tonight

Prefer paint path only when **frames exist** and UI is black. Here:

- No inbound frames on phone  
- No bind  
- No answer SDP  

Possible causes (need **connectionState** logcat + hub signal delivery for `aec9b44a`, not more ICE thrash):

1. Inbound offer never delivered / dropped before `handleRemoteSignal`  
2. `startCall` answerer path armed but offer applied never (`hasRemoteDescription` false)  
3. `startCall_skip_mutex` / early-kick race leaving warm PC without setRemote  
4. Cellular-only path with signal latency — still should leave ice=checking after setRemote  

Device-smoke logcat filters (`FATAL|ReactNative|AndroidRuntime`) only captured `rn-webrtc:pc:DEBUG getStats` — **no** `startCall` / `answer_*` / `signal ← offer` app lines. Cannot pick a single MediaSession line without that.

**MUST NOT done:** no pool>0, no force_relay thrash, no dual-offer, no deploy, no speculative hop.

---

## Next (human / next agent) — verify-first

1. Re-smoke PC browser ↔ phone **same call ≥20s**, Hide IP off; prefer both on same Wi‑Fi if possible (note cellular).  
2. Widen logcat: `ReactNativeJS` + app `log(` / connectionState (`startCall`, `signal ← offer`, `answer_`, `bind_`).  
3. Confirm hub journal for that match: `first offer` + **`first answer from=aec9…`** (or absence).  
4. Only then client-ice **one** hop:  
   - if offer never arrives → hub/signal routing  
   - if offer arrives, setRemote/answer hang → MediaSession answer path  
   - if fin>0 and UI black → then paint/ontrack/zOrder  
5. Re-run `./scripts/av-verify.sh --min 10` and read **android** rows in parsed av_path, not web-only fin.

---

## Scorecard snapshot (raw)

```text
verdict=WARN product=one-way app_vc=341 bind_v=0
web fin/fout=17/23 android fin/fout=0/0
fr_mismatch=True (polluted) media_pass=True signaling_ok=True
max_rb=516017 err_437=6
```

---

## One-liner

**Pixel remote Linking…/black = no answer / ice=new / bind_v=0 (no-media), not paint; web frames in scorecard were web↔web "Драконов". No code hop.**
