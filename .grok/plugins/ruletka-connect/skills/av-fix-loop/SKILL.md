---
name: av-fix-loop
description: >
  Verify-first loop for freenet-roulette / ruletka same-WiFi PC browser ↔ Android
  black cameras, no audio, "linking cameras", peer_usage≈0, force_relay thrash,
  one-way video (phone sees PC, PC black / frames_out=0), offer/answer without frames.
  Scorecard PASS can still be product FAIL — always read av_path both sides.
  Dispatches one subagent role per loop; dual-writer reconcile; compound wiki after
  solid hops. Use when user reports black cams / linking / A/V not connecting,
  one-way video, asks to fix WebRTC after thrash, or /av-fix-loop /av-verify /av-loop.
metadata:
  short-description: "Verify-first WebRTC A/V fix (no thrash)"
---

# AV fix loop (ruletka / freenet-roulette)

You **augment** the human (measure → explain → propose → implement when asked → re-measure).  
You do **not** automate APK/deploy or thrash ICE without a scorecard and clear direction.  
Stance: `AGENTS.md` (**augmentation**). Method: Karpathy Spec → Verifier → Environment.

| Layer | In this loop |
|-------|----------------|
| Spec | `knowledge/specs/current-av.md` (or DONE WHEN in job card) |
| Verifier | Step 0 scorecard **mandatory**; product = frames both sides |
| Environment | Wiki before hop; compound after PASS/STUCK/solid diagnosis |

Evidence beats theories. **Scorecard gate PASS ≠ product fixed.**

## Pre-flight (every hop)

1. `./scripts/av-verify.sh` (or `av-loop.sh`) → read `artifacts/av-verify/latest.*`  
2. Read **one** wiki page for the symptom if it exists (`knowledge/wiki/index.md` → e.g. `one-way-video.md`)  
3. Spec: `knowledge/specs/current-av.md` when A/V product goal  
4. Canonical gotchas: `references/GOTCHAS.md` (do not re-learn thrash)

## Gotchas (summary)

Full list: `references/GOTCHAS.md`. Hardest from multi-day thrash:

| # | Failure | Instead |
|---|---------|---------|
| A | Theory without scorecard | Measure first |
| B | Scorecard PASS, one-way black | Read av_path fin/fout **both** platforms |
| C | force_relay thrash / pool>0 | One hypothesis; pool=0 forever |
| D | Dual agents rewrite MediaSession | One writer **or** sequential + reconcile + rebuild APK if source newer |
| E | GOAL_MET=yes without smoke | Frames both sides **or** human both faces |
| F | TURN HOT + frames_out=0 → coturn thrash | **client-ice** (see `references/ONE_WAY.md`) |

## Non-negotiables

1. VERIFY before policy thrash / unprompted APK.  
2. One implementer **role** per loop; one **writer** per file set.  
3. Do not re-open locks without before/after scorecards.  
4. Never claim product fixed without frames both ways **or** human faces ≥30s.

## Source of truth

| File | Use |
|------|-----|
| `artifacts/av-verify/latest.json` | **`verdict` + `product`** + gates (v3) |
| `artifacts/av-verify/latest.md` | Human report + PRODUCT line |
| `artifacts/av-loop/*` | NEXT_ROLE, PRODUCT, job cards, **verify-after.md**, director.md |
| `knowledge/wiki/*` | Compounded symptoms |
| Locks | `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md` |

Agents **must** read `product.status`. Infrastructure PASS alone is not ship-ready when product is one-way.

## Step 0 — Score

```bash
./scripts/av-verify.sh --min 15
# After user starts match:
./scripts/av-verify.sh --min 10 --wait 90
# Prefer full route when multi-agent:
./scripts/av-loop.sh --min 10
```

Exit: `0` PASS/IDLE · `1` FAIL · `2` tool · `3` WARN.

**IDLE** → human Start once both, ≥20s, Hide IP off — no code.

### Product parse (always, even if verdict=PASS)

From av_path (latest match preferred):

| Field | Product meaning |
|-------|-----------------|
| web frames_in / android frames_out | Phone → PC video |
| android frames_in / web frames_out | PC → phone video |
| android force_relay + policy vs hub | Latch mismatch if hub true and phone `0`/`all` |
| app_vc / bind_v (if present) | Which APK; whether bind stuck |

**Product FAIL** if either direction has frames stuck at 0 after answers>0 and ≥10s match — even when signaling/TURN gates PASS.

## Step 1 — Diagnose (≤5 lines + product)

1. verdict + worst gate  
2. last_force_relay + platforms  
3. offers/answers + mto/mta  
4. max_rb + err_437  
5. av_path: fin/fout **web and android**; force_relay mismatch?  

Pick **exactly one** NEXT_ROLE.

## Step 2 — Decision tree

| Condition | Role | Notes |
|-----------|------|--------|
| IDLE / no match | **smoke** | Human checklist |
| answers=0, offers>0 | **client-ice** | Answerer path |
| android fin>0 fout=0 (or web fin=0 fout>0) + max_rb HOT | **client-ice** | **One-way** → `references/ONE_WAY.md` |
| answers>0 + tiny max_rb + force_relay=true | **turn-media** | Only if media plane cold |
| err_437 high + tiny media | **turn-media** | Pool storms |
| Signaling OK + frames both sides + human black UI | **client-ice** | Paint/ontrack only |
| Product frames OK + human both faces ≥30s | **ship** | Then APK/deploy if asked |
| After mobile ship, no smoke yet | **smoke** | Install APK first |

Prefer `./scripts/av-loop.sh` routing when available (encodes one-way).

## Step 3 — Subagents

Spawn **at most one implementer writer**. Paste scorecard + DONE WHEN + OWN.

Plugin agents: `diagnose`, `verify-only`, `client-ice`, `turn-media`.  
Personas: `strict-verify`, `no-thrash`.

### Multi-agent + Claude (director protocol)

1. `./scripts/av-loop.sh` → read `NEXT_ROLE`, `PRODUCT`, `director.md`, job cards.  
2. Spawn **one** Grok with full `grok-job.md` **or** Claude on `claude-job.md` — **not both thrashing the same file**.  
3. If both: sequential + reconcile + rebuild APK if `MediaSession.ts` mtime > APK.  
4. **Mandatory verify-after:** run `verify-after.md` / `./scripts/av-verify.sh` — never skip.  
5. Max **2** implementer hops without new smoke → STUCK.  
6. **GOAL_MET:** implementer `blocked` until smoke; director `yes` only if `product.status=ok` or human faces.

Plugin agent **director** = parent checklist. Slash: `/av-loop`. Design: `docs/AGENT_LOOP_DESIGN.md`.

### Role contracts (short)

**diagnose** — RO scorecard; 5 lines + NEXT_ROLE; parse product one-way.  
**client-ice** — web + Android media; one-way checklist in `references/ONE_WAY.md`; no coturn/pool.  
**turn-media** — coturn only when media cold / 437; if lock PASS + one-way → return client-ice.  
**verify-only** — re-score; product frames both sides; REVERT if worse; no feature code.

## Step 4 — Re-verify

```bash
./scripts/av-verify.sh --min 10
```

- Worse gates → revert.  
- Better signaling but product still one-way → next hop from **fresh** av_path (not new ICE thrash).  
- Product frames OK → human smoke if not done → stop thrash.

## Step 5 — APK / deploy (augmentation)

| Action | When |
|--------|------|
| Code | User asked fix or accepted one-step plan |
| APK build | Mobile changed + (user asked **or** authorized “proceed” on that fix) |
| Site download copy | Only if already authorized for smoke ship |
| push.sh / Play | Explicit human only |

After APK: **NEXT=smoke** (install + Start once). Do not claim fixed from code alone.

## Hard locks (summary)

- Web preferred offerer; Android answers; answerer no early addTrack.  
- `iceCandidatePoolSize = 0`.  
- Same public IP: follow **current hub + locks** (often pure TURN); do not thrash pure↔hybrid without scorecard.  
- Coturn dual-relay lock; no SFU default.  
- Full: `docs/CONNECTIVITY_LOCK.md`, `docs/VIDEO_PATH_LOCK.md`.

## Human smoke

1. Install **latest APK** if mobile changed (check `app_vc` on next av_path).  
2. PC hard-refresh live. Hide IP **off**.  
3. Start **once** both ≥20s. No Next spam.  
4. Agent: `./scripts/av-verify.sh --wait 90 --min 10`.

## After hop — Environment write-back

After PASS, STUCK, or solid diagnosis (not every failed theory):  
`/knowledge-compound` → update `knowledge/wiki/` + log.  
Do not compound “should be fixed” as PASS without frames/smoke.

## What “done” means

1. Human: both faces + audio ≥30s same Wi‑Fi, **or**  
2. Machine: web `frames_in≥10` **and** android `frames_out≥10` (and hub pure ⇒ android force_relay≈1).  
3. Not: “matched” UI alone, not signaling-only PASS.
