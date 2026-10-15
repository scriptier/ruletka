# BM1 find_third_result Android path audit — RESULT

**Status:** PASS (read-only; no code edits)  
**Date:** 2026-08-11  
**Scope:** `find_third_result` → `enterHuntingWithPartner` → `lookingForThird` / `huntingThird` wire; gaps that leave **full-screen brand only** (no partner video)  
**APK:** none (code-only static audit)  
**Skill / wiki:** `multi-party-stage` · gotchas §22–23 · prior W4b layout audit PASS  

---

## DONE WHEN

| Check | Result |
|-------|--------|
| `find_third_result` accept calls `enterHuntingWithPartner` | **PASS** |
| Hunt keeps `phase=matched` + does not clear `remoteStream` | **PASS** |
| `lookingForThird` driven by hunt flags + live primary remote (not bare `party_browse`) | **PASS** |
| `huntingThird` wraps 1v1 tree; does **not** set `multiRemote` | **PASS** |
| Full brand (`brandLoop`) gated off during hunt with partner | **PASS** |
| One-line proven fix required | **No** |

---

## End-to-end path

```
UI invite (findThirdInvite / browseTogether)
  → setFindThirdPending(true) + setHuntingWithPartner(true)   [inviter immediate hunt UI]
  → hub find_third_invite | browse_together

Partner accept (banner → hub.findThirdRespond(true))
  → hub fans out find_third_result { ok | reason:"accepted" }

HubProvider (toast + clear findThirdIncoming only)
  + live.tsx addMsg listener (layout owner)
      case "find_third_result":
        if ok|accepted → enterHuntingWithPartner("find_third_result")
        else → clear findThirdPending + huntingWithPartner

enterHuntingWithPartner(why):
  setHuntingWithPartner(true)
  setFindThirdPending(false)
  setMatchMode("party_browse")
  if phase ≠ matched → force matched   // NEVER pure search
  searchingRef = false

LiveStageVideo prop lookingForThird =
  !remoteStream2 && !remoteStream3
  && !!remoteStream
  && !!(huntingWithPartner || findThirdPending)

LiveStageVideo huntingThird =
  lookingForThird
  && !remote2 && !remote3
  && (hasRemote || remoteStream)
  && (phase matched|search || remoteStream)

brandLoop (full-stage BrandLoadingLoop) =
  !multiRemote && !huntingThird && !hasRemote && phase ∈ {idle, search}
```

**Hub fan-out:** `HubProvider` multi-listener (`listeners.forEach`) — both toast handler and `live.tsx` subscription receive the same message. Layout is **not** owned by HubProvider.

---

## Trace (source anchors)

### 1. Signal types

| Artifact | Path |
|----------|------|
| `ServerFindThirdResult` | `/home/drakosik/freenet-roulette/mobile/src/hub/types.ts` ~314–317 |
| Client invite / respond / cancel | `HubClient.ts` ~286–293 |
| Incoming banner accept | `mobile/app/_layout.tsx` ~515–528 → `hub.findThirdRespond(true)` + `router.push("/live")` |

### 2. `live.tsx` — `find_third_result` (~3530–3545)

```text
case "find_third_result":
  if (m.ok || reason === "accepted")
    enterHuntingWithPartner("find_third_result")  // CRITICAL comment: keep partner + split
    toast findThirdAccepted / trio.searching
  else
    setFindThirdPending(false)
    setHuntingWithPartner(false)
```

Reject/cancel/error clears hunt flags only — leaves 1v1 matched partner paint (no demotion to search here).

### 3. `enterHuntingWithPartner` (~4795–4805)

| Action | Full-brand risk |
|--------|-----------------|
| `setHuntingWithPartner(true)` | Enables looking strip wire |
| `setFindThirdPending(false)` | Invite-in-flight OR drops; hunt flag remains |
| `setMatchMode("party_browse")` | Mode bookkeeping; **not** used alone for layout |
| Force `phase = matched` if not already | **Blocks** pure-search full brand |
| `searchingRef = false` | Stops queue spin side-effects |
| Does **not** touch `remoteStream` | Partner media stays |

Comment lock: *Never demote to pure search (that full-screens brand and drops partner)*.

### 4. Other hunt **set** paths (same flags)

| Entry | Effect |
|-------|--------|
| `findThirdInvite` (~4762) | pending + hunting **before** result (inviter split immediately) |
| `browseTogether` (~4747) | pending + hunting + `party_browse` |
| Matched rematch (~2800–2814) | `findThirdPending=false`; if `extras>0` clear hunt; else if `mode===party_browse` keep hunting; else clear |

### 5. Hunt **clear** paths (leave 1v1 or leave match)

| Path | Clears hunt | Clears remote / phase |
|------|-------------|------------------------|
| `cancelFindThird` (~4778) | yes + clears sticky `party_browse` | no — stay matched 1v1 |
| `find_third_result` !ok (~3541) | yes | no |
| remote2/3 onRemoteStream | yes | multi takes over |
| Matched with extras | yes | multi |
| partner left / call_ended / start / next / stop | yes | yes (intentional leave) |

### 6. `lookingForThird` prop (~5655–5659)

```text
!remoteStream2 && !remoteStream3
  && !!remoteStream
  && !!(huntingWithPartner || findThirdPending)
```

- Requires live primary remote → cannot show hunt strip on empty stage.
- Ends when 2nd/3rd remote media lands.
- Comment: *matchMode party_browse alone must not stick after cancel* (gotcha 1c).

Label (~5740–5743): `t("trio.slotEmpty")` → `t("trio.searching")` → hardcode `"Looking for a 3rd…"`. Overlay EN (+ other locales) hold `trio.*` keys — caption not blank. (W8 miss-guard `t(k)!==k` not present as written in that RESULT; overlay presence makes raw-key paint unlikely. **Caption-only residual, not full-brand.**)

### 7. `LiveStageVideo` layout (~350–362, ~593–971)

| Flag | Definition |
|------|------------|
| `huntingThird` | lookingForThird ∧ no stream2/3 ∧ partner present ∧ matched/search/stream |
| `multiRemote` | `multiFromPeers` only (`pickStageStreams`: stream2 ‖ stream3 ‖ extraPeerCount) |
| `brandLoop` | !multi ∧ !huntingThird ∧ !hasRemote ∧ (idle\|search) |

Render (non-multi branch):

```
outer splitRemote (column) | splitRemoteWide (row if stageW/H ≥ 1.15)
  partner half → same 1v1 VideoView (displayMainStream)
  huntingThird → looking half BrandLoadingLoop + caption (testID live-looking-for-third)
PiP stays on 1v1 path (!multiRemote)
```

Comment lock: *Must NOT flip multiRemote (unmounts 1v1 RTCView → partner freezes)*.

Phone styles (`liveStyles.ts` ~670–736): `splitRemote` **column**; hunt tiles ~50% with partner `minHeight 45%`, looking `minHeight 35%`.

---

## Full-brand failure matrix (this audit)

Full-stage brand only when `brandLoop` is true. Map against find-third:

| Scenario | huntingThird | hasRemote | phase | brandLoop? |
|----------|--------------|-----------|-------|------------|
| Inviter after invite, partner live | true | true | matched | **false** (split) |
| Accept `find_third_result` ok | true | true | forced matched | **false** (split) |
| Hunt + remoteStream still live | true | true | matched | **false** |
| Hypothetical: hunting flags true, remote lost, still matched | false (needs remote) | false | matched | **false** (waiting/connect card, not brand) |
| Historical bug: demote to pure search + clear remote | false | false | search | **true** ← blocked by `enterHuntingWithPartner` |
| Reject / cancel find-third | false | true | matched | **false** (full partner 1v1) |
| Next / stop / partner left requeue | false | false | search | true (leave match — correct) |

**Conclusion:** No remaining static path where accept/hunt leaves **full brand only** while the first partner link should still paint. The gotcha-23 failure mode is **already guarded** in code.

---

## Findings

1. **`find_third_result` is handled in `live.tsx`** (layout), not only HubProvider toasts — PASS for gotcha 1b.
2. **`enterHuntingWithPartner` never demotes to search** and never clears `remoteStream` — blocks full-brand demotion.
3. **`lookingForThird` is flag + primary remote**, not bare `party_browse` — cancel does not leave sticky looking strip (gotcha 1c).
4. **Hunt ≠ multi:** 1v1 `VideoView` remains mounted; looking pane is a sibling; multi-audio gated at `nPeers ≥ 2` (~2940–2957).
5. **No one-line proven fix** for full-brand on this path. Read-only PASS.

### Residuals (not FAIL / not full-brand)

| Residual | Notes |
|----------|-------|
| Dual toast | HubProvider + live both toast on accept — UX noise only |
| Caption miss-guard | W8 claimed `t(k)!==k`; current wire is `t() \|\| t() \|\| hardcode`; overlays have keys — caption residual if keys regress |
| Invitee pre-accept | No looking strip until accept — expected 1v1 |
| Multi handoff | `extraPeerCount > 0` before stream2 can flip multi tiles early — intentional, not brand-only |
| Human smoke | Multi / find-3rd human smoke still **OPEN** per wiki — this card is static only |

---

## Files reviewed (no edits)

- `/home/drakosik/freenet-roulette/mobile/app/live.tsx` — find_third_result, enterHuntingWithPartner, lookingForThird prop, multi-audio gate, clear paths
- `/home/drakosik/freenet-roulette/mobile/src/live/LiveStageVideo.tsx` — huntingThird, multiRemote, brandLoop, render tree
- `/home/drakosik/freenet-roulette/mobile/src/live/liveStyles.ts` — column mid-split hunt tiles
- `/home/drakosik/freenet-roulette/mobile/src/live/stageStreams.ts` — multiRemote definition
- `/home/drakosik/freenet-roulette/mobile/src/hub/HubProvider.tsx` — find_third_result toast + fan-out
- `/home/drakosik/freenet-roulette/mobile/src/hub/types.ts` / `HubClient.ts`
- `/home/drakosik/freenet-roulette/mobile/app/_layout.tsx` — find_third_incoming accept
- `/home/drakosik/freenet-roulette/.grok/skills/multi-party-stage/SKILL.md`
- `/home/drakosik/freenet-roulette/knowledge/wiki/gotchas.md` §22–23

---

## Connect risk

**None.** No ICE / MediaSession / pool / deploy / APK. Layout + hub message routing only; already aligned with multi-party gotchas (do not flip `multiRemote` for hunt-only; do not pure-search on find-third accept).

---

## COMPLETE

Static audit **PASS**.  
`find_third_result` (ok/accepted) → `enterHuntingWithPartner` → `huntingWithPartner` + `party_browse` + **matched** phase → `lookingForThird` (requires `remoteStream`) → `huntingThird` column split with partner RTCView kept mounted. Full-screen brand requires idle/search with no remote and no hunt — **not** reachable on the accept/hunt path with current code. No fix; no APK.
