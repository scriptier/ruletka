# Spec: keep remaining pair when 3rd leaves + P2P honesty

**Status:** active · 2026-08-14  
**Lock:** `docs/CONNECTIVITY_LOCK.md` — same public IP **stays** `force_relay=true`.  
**Not this hop:** wipe TURN / “always host P2P” (that path was black).

```text
GOAL: (1) 3-way: if one person leaves, the other two stay in the same
      call — no Linking restart, no new offer/answer for the survivor.
      (2) UI: “Relayed” is not painted as “we lost P2P.”
DONE WHEN:
  A) Extra peer bye/stop: close only that PC; remaining remote keeps
     srcObject / RTCView; layout 3→2 tiles; no closeAllPeers rematch.
  B) Android: extra hangup does not startCall primary again.
  C) Badge: same-LAN TURN = designed path, not broken P2P.
  D) pool=0; no force_relay flip; no SFU.
EVAL:
  - node --check ui/live.js
  - matchContinuity / mediasessionMultiSafety
MUST NOT: pair_force_relay false on same IP; pool>0; deploy; invent
          product.ok / MULTI_PASS
```

## Brainstorm (recommended vs not)

| Idea | Do? |
|------|-----|
| Flip same-LAN off TURN so “always P2P” | **No** — host hairpin black; lock |
| SFU so server mixes 3-way | **No** — not default |
| Keep remaining 1v1 when 3rd leaves | **Yes — this hop** |
| UI: Relay = same-Wi-Fi TURN, mesh still P2P | **Yes — this hop** |
| Lower extra encode / drop unused TURN when 3rd gone | Later, not ICE policy |
| Local LAN TURN | Later; not docker coturn revival |

Signaling is already mesh P2P. Same house uses FRA coturn so cameras work.
