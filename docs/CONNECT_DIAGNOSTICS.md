# Connect diagnostics — what we have, what's missing, cheapest next tool

Director cheat-sheet for the 2026-08-25 smoke fails: **recvonly** offers (no
camera), **ghost WS** (no answer), extra tabs / same `user_id`, one-way
frames, Friend Call "offline", leftover Start. No ICE thrash, no new
always-on `force_relay`. Existing locks stay: `docs/CONNECTIVITY_LOCK.md`
(pool=0), `docs/AV_FIX_SUBAGENT_PLAN.md` (VERIFY before APK).

---

## 1. Now vs Gap vs Tool

| # | Symptom | Now (already have) | Gap | Cheapest next tool |
|---|---------|---------------------|-----|---------------------|
| 1 | **recvonly / sendonly offer** (no camera on one side) | Hub already logs `video_dir` on every `offer`/`answer` connect-event (`sdp_video_direction`, `bridge/src/simple.rs`) and warns in journal `"answer video not sendrecv"`. `ui/admin-connect.html` table has no `video_dir` column — you must grep journal to see it. | `video_dir` is computed and stored in `connect_events` but not rendered. | Add a **Dir** column to the admin-connect table reading `e.video_dir` (offer/answer rows only); color it red when `recvonly`/`sendonly` on an answer. ~10-line JS diff in `ui/admin-connect.html`, no server change. |
| 2 | **No answer in N seconds** (zombie partner) | `connect_events` has `offer` (with `ms` = match→offer) but no explicit "answer timeout" event; you infer it by diffing offer count vs answer count in the stats row (`Offers` vs `Answers`). | No per-match "still waiting Xs" signal — only a global counter after the fact. | `./scripts/connect-monitor.sh --watch 5` already re-polls the hub every 5s; cheapest addition is a **CLI one-liner**, not new code: `journalctl -u roulette-bridge -f | grep -E 'first offer|first answer'` and eyeball the gap in wall-clock timestamps. No code change needed tonight. |
| 3 | **Same `user_id` two sockets** / extra tabs | Hub already **kicks the previous connection** on a second `Hello` for the same `user_id` ("one live tab per identity", `simple.rs` ~line 7405) — this is a server-side fix, not just a diagnostic gap. | No visible **event** when a kick happens — you can't tell from admin-connect.html that tab A got kicked by tab B; you only see the symptom (call drops mid-match). | Emit a `push_connect_event({"kind":"kick_dup_tab","user_id":short_id})` at the existing kick site (one line next to the `by_user.insert` kick). Small, additive, no policy change — flag to human as a candidate 3-line hub patch, not doing it unless asked (task OWN is docs only). |
| 4 | **One-way frames** (`in>0 out=0` or vice versa) labeled a PASS | `av-verify.sh` gate comment already says: `WARN PRODUCT one-way / no dual frames (even if TURN HOT) — not ship-ready`; `latest.json.product.status` is supposed to carry this. Gotchas #35/#43/#51/#57/#60 are all real one-way incidents that got caught. | Nothing structural is missing — the rule exists. The actual gap is **discipline**: several gotchas record agents almost calling `product.ok`/`PASS` off `av-verify` infra-PASS alone while `product.status` was one-way. | No new tool — a **one-line rule reminder**, not code: any RESULT/verdict must quote `product.status` verbatim (not just top-level `verdict`). Cheapest enforcement: `grep -q '"status": *"ok"' artifacts/av-verify/latest.json` in the human/verify checklist before writing PASS. |
| 5 | **Friend Call "offline"** vs they are `waiting_solo` | `call_friend` offline branch fires whenever `self.by_user.get(&user_id)` is `None` — i.e. no live socket registered under that persistent `user_id` (`simple.rs` ~8913). A friend who is connected and just sitting in the solo queue is **not** "offline" by this check — only a genuinely dropped/never-registered session is. | No admin-visible way to check **why** `by_user` lacks the entry (dropped socket vs never sent Hello vs duplicate-tab kick per #3) — today you only see the generic error string client-side. | Describe-only per task scope: an admin lookup `GET /v1/admin/user_state?user_id=X` returning `{in_by_user: bool, in_queue: bool, room, last_seen_ip}` would disambiguate in one call. Not implemented here (would touch `bridge/src`, outside docs-only OWN) — flag as candidate #2 below. |
| 6 | Client-side WebRTC internals for testers | None documented for non-agent testers. | Testers don't know where to look when told "check ICE state". | Zero-cost: **`chrome://webrtc-internals`** while `live.html` is open → expand the active `RTCPeerConnection` → check `Video (recv)`/`Video (send)` byte counters climbing and `ICE Candidate pair` `state: succeeded`. One line for `docs/DEVICE_SMOKE.md` testers: *"if black, open `chrome://webrtc-internals` in a second tab before hanging up — screenshot the top PC's stats table."* |
| 7 | Machine-readable **live snapshot** across match/offer/answer/kick/friend-call state in one shot | `GET /v1/admin/connect_live` (used by `ui/admin-connect.html`) already returns `{verdict, summary:{matches,offers,answers,drops,web_relay0,phone_relay0,...}, events[], online, waiting}` — a real JSON admin endpoint exists today. | It's SDP/relay-timing only — no `user_id` dedupe state, no friend-call offline reasons, no `video_dir` in `summary`. Building a broader `/v1/admin/live` (per task hint) would mean adding fields to the *existing* endpoint, not a new one. | **Describe only (per task scope):** extend `connect_live`'s existing `summary` object with `video_dir_bad` (recvonly/sendonly count) and `dup_tab_kicks` counters, reusing the same `connect_events` deque. This is a `bridge/src/simple.rs` change — outside this task's docs-only OWN; noted here for the next hub-touching task. |

---

## 2. Ranked next tools (1 = cheapest)

1. **Add a `Dir` column to `ui/admin-connect.html`** showing `video_dir` per offer/answer row, red on `recvonly`/`sendonly`. Pure front-end, reads a field the hub already emits. Fixes gap #1 today.
2. **`chrome://webrtc-internals` tester note** in `docs/DEVICE_SMOKE.md` (one paragraph). Zero code, immediate value for any human/tester report of black cam. Fixes gap #6.
3. **`product.status` quoting rule** in the verify checklist (`docs/AV_FIX_SUBAGENT_PLAN.md` §2/§5 already implies it — make it explicit as a grep step). Zero code. Fixes gap #4 (discipline, not tooling).
4. **`kind: "kick_dup_tab"` connect-event** at the existing `by_user` kick site in `bridge/src/simple.rs`. ~3-line hub patch, additive only, no policy/ICE change. Fixes gap #3's visibility (the fix itself already exists).
5. **`GET /v1/admin/user_state?user_id=`** read-only lookup (`in_by_user`, `in_queue`, `room`, `last_seen_ip`) to disambiguate "actually offline" vs "queued/duplicate-kicked". Bigger than a stub (new route + handler); do only if a human/Grok wants it — needs a human OK since it's a new admin surface, not a docs change.

Items 4–5 touch `bridge/src/simple.rs` (outside this task's OWN: `docs/CONNECT_DIAGNOSTICS.md` only) — listed as candidates for the next hub-touching task, not implemented here.

---

## 3. Read but not rewritten (source of the "Now" column)

- `docs/AV_FIX_SUBAGENT_PLAN.md` — subagent roles, evidence commands, decision tree, hard locks.
- `docs/CONNECTIVITY_LOCK.md` — frozen client/hub rules, pool=0, `force_relay` triggers.
- `scripts/av-verify.sh` (header) — scorecard contract, exit codes, `product.status` gate.
- `ui/admin-connect.html` — current live table: Matches/Offers/Answers/Drops/relay counts/Online/Waiting, polling `GET /v1/admin/connect_live`.
- `knowledge/wiki/gotchas.md` (first 80 lines / items 1–65) — prior incidents; #3/#28 (dup-tab kick), #35/#43/#51/#57/#60 (one-way frames mislabeled), #40 (per-client offer debounce), #61 (offline vs split-IP).
