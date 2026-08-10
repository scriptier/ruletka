# Design: “Open on PC” QR (phone → browser)

**Status:** design only · **Task:** `090` · **No hub protocol change yet**  
**Date:** 2026-08-08

## Goal

From the **phone** (idle, searching, or in a call), show a QR / link so the user can open **the same hub identity experience on a PC browser** without re-learning friend codes. Later phases may move a live match; v1 must not touch WebRTC offer path.

## Why

- Play users often want a bigger screen for long chats.
- Export/import works but is heavy for “just open desktop now”.
- Friend code + deep links already exist (`APP_LINKS`, `friendInvite`); QR is a discoverable surface.

## Non-goals (explicit)

| Do not | Why |
|--------|-----|
| Rewrite match / SDP / offerer selection overnight | Connect path is **locked** (`CONNECTIVITY_LOCK`) |
| Transfer live P2P mid-call in v1 | Risk of thrash, black stage, double-offer |
| New multi-hub / SFU dependency | Out of scope |
| Deploy or Play upload as part of this task | Design (+ optional unwired stub only) |
| Bulk APKs on the public site | Existing policy |

## User stories

1. **Identity handoff (P0 product value)**  
   “I’m on the phone at home → scan with PC → browser has **my** `user_id` / friend code / friends list.”
2. **Call / queue handoff (P1, later)**  
   “I’m searching or matched on phone → continue that queue/match on PC.”
3. **Watch-only / invite a second device (P2)**  
   Optional; not required for launch.

## Options compared

### A — Friend-code + export token deep link (recommended v1)

```text
https://ruletka.vip/?open=pc&code=ABCD12
  or  ruletka://open-pc?code=ABCD12
```

| Pros | Cons |
|------|------|
| No new hub APIs | PC is a **new** browser identity unless user imports backup |
| Reuses share/invite surfaces | Does not “continue this call” |
| Safe: public friend code already shareable | User may expect full session move |

**Fit:** shippable UX copy “Add me / open site” — not true session transfer.

### B — One-shot claim ticket (recommended v1.5 identity)

Phone asks hub for a **short-lived claim**:

```json
{ "type": "pc_claim", "ticket": "…", "exp_ms": 120000 }
```

QR → `https://ruletka.vip/claim?t=…`  
PC browser presents ticket once → hub binds browser connection to **same `user_id`** (or merges after confirm).

| Pros | Cons |
|------|------|
| Real identity continuity without password file | New hub messages + store for tickets |
| Expires fast (1–2 min); one-use | Must handle phone still connected (kick / dual session policy) |
| Clear security story | Needs careful dual-tab policy |

**Dual session policy (pick one before implement):**

1. **Kick phone WS** when claim succeeds (simple).  
2. **Allow both** read-only friends until one Starts Live (harder).  
3. **Prefer newest** connection for match queue (medium).

Recommend **(1)** for first ship.

### C — Match / room transfer token (P1 only)

While `phase=matched` or `search`, issue `handoff_token` that:

- moves the **queue seat** or  
- re-binds the **room** to the PC peer id,

then phone leaves cleanly (`stop` / `leave`).

| Pros | Cons |
|------|------|
| True “continue this chat” | Touches matchmaking + SDP; high regression risk |
| Great demo | Needs offerer re-election (web preferred) + TURN budgets |

**Gate:** only after 5 green pair-smoke runs post-change; never in same PR as unrelated live polish.

## Recommended phased plan

| Phase | Ship | Protocol | UI |
|-------|------|----------|-----|
| **0** | This doc | none | — |
| **1** | Settings / Live sheet: QR of `https://ruletka.vip` + friend code text | none | Unwired or link-only |
| **2** | `pc_claim` ticket (B) | hub ticket mint/claim | Phone modal + PC landing |
| **3** | Optional match handoff (C) | handoff + clean leave | Live “Continue on PC” when matched |

## UI sketch (phase 1–2)

```
┌ Live / Settings ─────────────────┐
│  Open on PC                      │
│  ┌──────────┐  Scan with phone   │
│  │   QR     │  camera or PC cam  │
│  │          │  Link expires 2m   │
│  └──────────┘                    │
│  Or open: ruletka.vip/claim?t=…  │
│  [ Copy link ]  [ Close ]        │
└──────────────────────────────────┘
```

- Entry: Settings row + optional Live overflow (not primary chrome).
- Do **not** cover the video stage during an active call without an explicit tap.
- A11y: large “Copy link” for desktop-without-camera.

## Security

| Threat | Mitigation |
|--------|------------|
| Ticket QR photographed / shared | TTL ≤ 2 min, single use, bound to phone `user_id` |
| CSRF on claim page | POST + origin check; no GET side-effect prefer |
| Claim steals account while attacker has QR | User must have physical phone + PC in room; short TTL |
| Mid-call hijack (phase 3) | Require both peers re-ICE; phone sends explicit leave first |
| Phishing fake claim URL | Fixed path on `ruletka.vip` only; pin in app config |

## Protocol sketch (phase 2 only — not implemented)

```text
Phone → hub:  { "type": "pc_claim_create" }
Hub → phone:  { "type": "pc_claim", "ticket": "…", "exp_ms": 120000, "url": "https://…" }

Browser → hub (after WS hello): { "type": "pc_claim_redeem", "ticket": "…" }
Hub → browser: identity bind OK / error
Hub → phone:   { "type": "pc_claim_used" }  → phone may toast “Opened on PC” and idle
```

Storage: in-memory map or short Redis-like TTL file; **not** durable across hub restarts (claim again).

## Mobile stub (optional, unwired)

If added later:

- `mobile/src/pc/OpenOnPcSheet.tsx` — pure UI, props: `{ url, code, expLabel, onCopy, onClose }`
- **Not** called from match / `start` / offer path until phase 2 is reviewed.

## Risks to CONNECTIVITY_LOCK

- Phase 1: **zero** risk (static QR).  
- Phase 2: identity only — avoid calling `spin` / offer from claim path.  
- Phase 3: **high** — treat as connect feature; full DEVICE_SMOKE + pair smoke.

## Exit criteria for implementation PRs

1. Design reviewed (this file).  
2. Phase 1: copy + QR of public URL; no hub change.  
3. Phase 2: ticket mint/redeem + dual-session policy tests.  
4. Phase 3: separate PR; smoke checklist signed off.

## Related

- `docs/APP_LINKS.md` · `docs/ROADMAP_PLAY_BROWSER.md` F1  
- `docs/CONNECTIVITY_LOCK.md` · `docs/FRIENDS_PARTY.md`  
- Task: `tasks/admin-queue/pending/090-open-on-pc-qr-design.md`
