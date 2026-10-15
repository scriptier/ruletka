# 850 — connect diagnostics tools (research + doc) — RESULT

**Status:** COMPLETE

## Files touched
- Created `docs/CONNECT_DIAGNOSTICS.md` (only file in OWN)
- Overwrote this RESULT file (a stale RESULT from an earlier attempt existed
  at this path; `docs/CONNECT_DIAGNOSTICS.md` itself was untracked/absent in
  this worktree before this run — `git status` confirms it as a new `??` file)

## What it contains
- Table: **Now / Gap / Tool** covering all 7 required gaps — recvonly/
  sendonly visibility, no-answer/zombie-partner detection, duplicate
  `user_id`/extra-tab visibility, one-way frames mislabeled as PASS, Friend
  Call "offline" vs `waiting_solo`, a `chrome://webrtc-internals` tester
  one-liner, and a described-only extension to the existing
  `/v1/admin/connect_live` endpoint (task's "`/v1/admin/live`" hint —
  that endpoint already exists under this name).
- Ranked 5 next tools, cheapest first: (1) render `video_dir` (already
  computed server-side) as a column in `ui/admin-connect.html`, (2) add a
  `chrome://webrtc-internals` line to `docs/DEVICE_SMOKE.md`, (3) make the
  `product.status` grep explicit in the verify checklist, (4) push a
  `kind: "kick_dup_tab"` connect-event at the existing silent dup-tab kick
  site in `bridge/src/simple.rs`, (5) new `GET /v1/admin/user_state`
  lookup (largest — needs human sign-off, not implemented).

## Research method
This worktree (`claude/p0-connectivity`) is missing `scripts/av-verify.sh`
and `knowledge/wiki/gotchas.md` (not tracked here). Read both **read-only**
from the sibling main tree (`/home/drakosik/freenet-roulette`, owned by
Grok) instead of inventing content; no writes there. Read in this worktree:
`docs/AV_FIX_SUBAGENT_PLAN.md`, `docs/CONNECTIVITY_LOCK.md`,
`ui/admin-connect.html`. Grepped `bridge/src/simple.rs` (main tree,
read-only) to ground every claim in real code, not assumption:
- `sdp_video_direction()` (~line 28) — confirms `video_dir`
  (recvonly/sendonly/sendrecv) is parsed and already attached to every
  `offer`/`answer` `connect_event`, plus a journal warning when an answer
  isn't `sendrecv`.
- `push_connect_event` / `MAX_CONNECT_EVENTS` (~line 8534) and the
  `connect_live` summary builder (~line 8560+) — confirms the JSON summary
  (`matches, offers, answers, drops, relay_min/max, ...`) has no
  `video_dir` aggregate and no dup-tab counter.
- `by_user.insert` kick-on-reconnect comment "one live tab per identity"
  (~line 7405) — confirms the duplicate-tab fix already exists server-side
  but emits no `connect_event`, so it's invisible in the admin UI.
- `call_friend` offline branch (~line 8913) — confirms "offline" means
  `self.by_user.get(&user_id) == None`; a friend sitting in the solo queue
  is not "offline" by this check, but there's no admin call to see *why*
  `by_user` lacks the entry (dropped socket vs dup-tab kick vs never
  registered).
- `scripts/av-verify.sh` header (main tree) — confirms the `product.status`
  one-way gate is already documented as a hard rule; the actual gap is
  discipline (agents citing `verdict` PASS without quoting
  `product.status`), not missing tooling.
- `knowledge/wiki/gotchas.md` items 1–65 (main tree, first read through the
  full file since it was short enough) — grounded gaps #3/#28 (dup-tab
  kick), #35/#43/#51/#57/#60 (one-way frames mislabeled), #40 (per-client
  offer debounce), #61 (offline vs split-IP) against real incidents instead
  of guessing.

## Verify commands run
None applicable — doc-only task, no code changed.
```
git status --short   # only docs/CONNECT_DIAGNOSTICS.md (new, untracked) + this RESULT touched
```

## Connect risk
**none** — no code changed (hub, client, ICE, MediaSession, coturn all
untouched). Pure documentation in the OWN file only.

## Merge advice
Safe to merge standalone; `docs/CONNECT_DIAGNOSTICS.md` is a new file, no
conflicts expected. Ranked items #4 (dup-tab connect-event) and #5
(`/v1/admin/user_state` lookup) touch `bridge/src/simple.rs` — out of this
task's docs-only OWN — flag for director triage as a follow-up hub task,
not auto-implemented here.

COMPLETE
