# improve-system proposals — 2026-08-11 UX thrash process

Delta since LAST_RUN 2026-08-10T23:30Z.

## Reviewed (bounded)

- LAST_RUN / improve-system log (P1–P5 applied; P6 no auto-fire denied)
- Specs: current-ship-ux, current-mobile-ux, SMOKE-NEXT, linking-speed
- Wiki: mobile-ux, gotchas, pre-apk-verify, index, log
- Skills: improve-system, agentic-engineering, karpathy-method (meta)
- Evidence: APK series 0.1.317→0.1.329 without human smoke paste; method Q&A 2026-08-11
- **Already applied this session (bookkeeping, not proposals):** SMOKE-NEXT + ship/mobile specs retarget 0.1.329 + hop10; wiki compound thrash lessons

## Proposals (await human)

### P1: No APK flood without smoke gate
WHY: ~12 APK version bumps in one thrash window while SMOKE-NEXT never got a paste-back; violates Spec→Verify→Environment and current-ship-ux idle stance.
WHERE: `AGENTS.md` Always/Never; optional note in `agentic-engineering` skill; `pre-apk-verify.md` agent contract.
CHANGE: Add hard process rule: after one successful `npm run verify` + one `build-apk-local --bump`, **stop** until human smoke paste or explicit FAIL lines. Second bump in same session requires FAIL ticket text in chat.
RISK: low
APPROVE?: approved

### P2: Keep SMOKE-NEXT install target in lockstep with latest APK
WHY: Specs pointed at 0.1.309 while latest was 0.1.329 — agents and human install wrong binary.
WHERE: `mobile/scripts/build-apk-local.sh` (or post-bump hook) + short AGENTS Always line.
CHANGE: On successful version bump, print/remind to update `knowledge/specs/SMOKE-NEXT.md` install line (or sed-update version string only). Do not auto-edit DONE WHEN semantics.
RISK: low
APPROVE?: approved

### P3: L0 invariant — PartnerIdentityDock when matched (incl. browser layout)
WHY: Dock is `matched && !isBrowserLayout`; browser layout may hide the only SurfaceView-safe identity strip; top chrome alone is known-flaky on Android SurfaceView.
WHERE: `mobile/app/live.tsx`; `mobile/scripts/verify-match-ux.mjs` L0.
CHANGE: Show dock whenever `uiPhase === "matched"` (drop browser exclusion) **or** document browser-only top chrome if intentional; L0 assert dock mounts when matched. Code hop only after smoke FAIL or explicit approve.
RISK: med (layout spacing on browser mode)
APPROVE?: pending — other agent owns dock code; not applied here

### P4: Default one implementer + one verify-only (no multi-writer fire)
WHY: Parallel location/blur/speed/chrome agents produced Modal races and thrash; method says one writer.
WHERE: `AGENTS.md`; `agentic-engineering` skill; optional av-loop director note for UX lane.
CHANGE: Default for UX: one implementer OWN files + optional verify-only/check-work. Multi-agent only when human lists ≥2 independent FAIL lines with non-overlapping OWN.
RISK: low
APPROVE?: approved

### P5: Mandatory compound after thrash (≥3 APKs or multi-day stuck)
WHY: Lessons (keep RTC, identity dock, mto→web first) lived in chat until this session; wiki lagged.
WHERE: `AGENTS.md` Knowledge ops; `knowledge-compound` skill trigger line.
CHANGE: If session ships ≥3 APKs or >1 day stuck on same DONE WHEN, run compound (raw + wiki gotcha) before next implementer hop.
RISK: low
APPROVE?: approved

### P6: Encode “mto≥20s → web first” in pre-APK + av-fix preflight one-liner
WHY: Gotcha exists in pre-apk-verify wiki but agents still shipped mobile HUD during 25s linking.
WHERE: `.grok/skills/av-fix-loop/references/GOTCHAS.md` or preflight; `verify-before-apk.sh` L2 message; mobile-ux skill if any.
CHANGE: When journal/av-verify max_mto ≥ 20000, L2 FAIL or loud WARN: “fix live.js?v= on PC; block mobile HUD APK unless UX-only FAIL”.
RISK: low
APPROVE?: approved

---

Human: `proceed with improvements` → apply P1,P2,P4,P5,P6 (NOT P3 code).  
Applied 2026-08-11 (process docs/scripts only; no deploy / ICE / APK).
