# Pre-APK verify ladder

> Fail closed before `assembleRelease`. Cheap checks first; APK last.

## Ladder

| Layer | Script / tool | Cost | Blocks build? |
|-------|---------------|------|----------------|
| **L0** | `mobile/scripts/verify-match-ux.mjs` | ~1s | **yes** |
| **L1** | unit tests + `npm test` | ~5–15s | **yes** |
| **L2** | hub health, `deploy.json`, `live.html` `?v=`, hop markers, optional av-verify | ~5–20s | soft (WARN) unless `VERIFY_STRICT_L2=1` |
| **L3** | emu UI dump (manual / `emu-test.sh`) | 1–2m | not wired yet |
| **L4** | `build-apk-local.sh` | ~3m | only if L0–L1 green |
| **L5** | human smoke + `./scripts/av-verify.sh` | human | product.ok |

## Commands

```bash
cd mobile
npm run verify              # L0+L1+L2 soft
npm run verify:strict       # L2 failures also block
npm run test:match-ux       # L0 only
./scripts/build-apk-local.sh --bump   # runs verify first
SKIP_VERIFY=1 ./scripts/build-apk-local.sh --bump   # emergency override
```

## L0 invariants (match UX thrash killers)

1. `showStagePartnerHud` not hardcoded `{false}` — must enable when matched  
2. Nuclear blur: `mountMainVideo` gated on `privacyBlur` + partner-on-main  
3. `PartnerBlurVeil` on partner tile when veiled  
4. Partner ★ display uses max(stars, trust) / displayPartnerStars  
5. `live-blur-btn` + `onToggleBlur` wired  
6. Repo `ui/live.html` has `live.js?v=N` + `webrtc.js?v=N`  
7. Repo `ui/live.js` has stuck-offer recovery markers (`free stuck inflight`)

## L2: do not thrash mobile for 25s MTO

If av-verify / journal shows `max_mto ≥ 20000`:

1. Check `https://ruletka.vip/live.html` for current `live.js?v=`  
2. Hard-refresh PC (or private window)  
3. Confirm `live.js?v=N` body contains hop recovery markers  
4. **Do not** ship more mobile HUD/blur APKs until web stamp is current (linking lag is a web-first fix; mobile only if UX-only FAIL)  

`verify-before-apk.sh` L2 emits a loud WARN on `max_mto ≥ 20000` with the same rule.

## Agent contract

Before `build-apk-local --bump`:

```text
L0 static: PASS/FAIL
L1 units: PASS/FAIL
L2 deploy/mto: PASS/WARN/FAIL
BUILD: allowed | blocked
```

One verify pass → then at most one implementer hop → re-verify → **one** APK.  
**Smoke gate:** after one successful verify + one `--bump` in a session, **stop** until human smoke paste or explicit FAIL lines. Second bump requires FAIL ticket text.

## Related

- [connect-scorecard](connect-scorecard.md) — av-verify  
- [mobile-ux](mobile-ux.md) — loc · stars · blur  
- [linking-speed](linking-speed.md) — mto/mta  
- [gotchas](gotchas.md) — thrash anti-patterns  
