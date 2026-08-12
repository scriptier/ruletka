# Gotchas — connect / A/V thrash (canonical short list)

Authoritative workflow: skill `av-fix-loop` · plan: `docs/AV_FIX_SUBAGENT_PLAN.md` · wiki: `knowledge/wiki/gotchas.md`.

Proven through multi-day same-WiFi PC black thrash ending **2026-08-10 product.ok** (app_vc=305).

1. **No scorecard → no code.** Theories without `artifacts/av-verify/latest.json` caused days of flip-flop.
2. **SDP success ≠ media success.** Offers/answers can be fast while cams stay black.
3. **Scorecard PASS ≠ product PASS.** Signaling + TURN HOT can PASS while one-way fails. Read **`product`** + av_path both sides.
4. **One policy change per loop.** Same-IP force_relay pure↔hybrid thrash without before/after proof.
5. **pool > 0 kills TURN.** Warm multi-ALLOCATE → error 437 → peer_usage≈0.
6. **Answerer never addTrack before setRemote.** Extra m-lines → no-answer / one-way black.
7. **No APK “to try” before a measure.** After mobile fix: build when authorized; **human smoke** before GOAL_MET=yes.
8. **One implementer writer.** Dual Claude+Grok on MediaSession → reconcile + rebuild APK if source newer.
9. **Matched UI / gifts ≠ video.** Path can signal while RTP never flows.
10. **Coturn lab PASS ≠ browser path OK** without client bind / force_relay latch.
11. **force_relay mismatch** — hub/web pure while android `force_relay:0 policy=all` → one-way. Fix client latch, not coturn.
12. **Mid-nego PC rebuild** — `ensureRelayPolicyPc` must not close PC after answerer bind (orphans tracks).
13. **closeCall(keepLocal) must not wipe hub force_relay sticky** — match rebuild cleared sticky → answer policy=all while web pure (app_vc=303→304 fix).
14. **bind_v≥1 ≠ encoding** — RN can show bound video track with `frames_out=0` / `bytes_out=0`. Force `encodings[].active=true`, fresh GUM, null→replaceTrack, keyframes (app_vc=305 fix).
15. **Stale APK after dual edits** — if `MediaSession.ts` mtime > APK mtime, rebuild before smoke.
16. **GOAL_MET=yes without smoke/frames** — director claims product done only with product.ok or human both faces.
17. **Diagnose layers separately:** (A) pure latch/sticky → (B) bind m-line → (C) encoder active. Do not thrash A when C is the failure.
