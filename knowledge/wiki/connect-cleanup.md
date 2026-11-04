# Connect / UI safe cleanup

Single-surface UI + safe MediaSession hygiene. **Not** an ICE rewrite. Spec (archived): [`../specs/archive/current-ui-dedupe-connect-cleanup.md`](../specs/archive/current-ui-dedupe-connect-cleanup.md).

**Herd run:** `20260814T020528Z` (2026-08-14) — 5/5 lanes **GOAL_MET=yes**.  
**Raw:** [`../raw/2026-08-14-herd-connect-safe-cleanup.md`](../raw/2026-08-14-herd-connect-safe-cleanup.md) · P1 map [`../raw/2026-08-13-connect-p1-extract.md`](../raw/2026-08-13-connect-p1-extract.md).  
**Honest:** units + static only. **No product.ok / human PASS / APK** from this hop.

## Status

| Slice | State |
|-------|--------|
| UI A–D (2026-08-12) | **Done** — one flag, connect card status-only, mute 🔇 only, thin blur modal, one Friends offline CTA |
| P0 tests import real `connectUi` | **Done** (Claude 479) — lock soft ≥16s |
| P0 dead `attachLocalTracksFireAndForget` | **Done** (ms-safe) |
| P0 outbound watch timers on `closeCall` | **Done** (ms-safe) |
| P0 `[client-ice]` console demote | **Done** (ms-safe) |
| UI leftover unused | **already-clean** (void mute/flag props intentional) |
| Sibling retry/stats unused | **already-clean** |
| P1 extract IceSdpUtils / latch / bind / budgets | **Inventory only** — do not split until a single-writer hop + smoke |
| P2 hop-budget / recovery-wave merge | **Out** — needs product.ok smoke |

## Gates (EVAL)

- `node mobile/src/media/connectUi.test.mjs` + `node mobile/scripts/test-connect-ui.mjs` import **real** module (transpile like `test-geo-localize.mjs`).
- No soft@10s — CONNECTIVITY_LOCK schedule is 16 / 26 / 36 s.
- `grep attachLocalTracksFireAndForget mobile/src/media/MediaSession.ts` empty.
- `grep youMutedThemToast` not on mute toggle (i18n keys may remain).
- `mediasessionMultiSafety.test.mjs` + `dev-smoke --unit`.
- Do **not** invent connect GOAL_MET from this page.

## MUST NOT

- Dual-write `MediaSession.ts` (gotcha #7).
- `pool>0`; sticky clear on `keepLocal`; answerer re-offer; hop11 global cap &lt;180.
- Implement P1 extract and P0 in two writers.
- Treat unit PASS as `product.ok`.

## Next hop (when human asks)

1. **One writer** `MediaSession.ts`: first slice **pure** `iceSdpUtils.ts` (move-only) + retarget `offerSdpLooksPureRelay.test.mjs`.  
2. Latch unify / `bindAnswerOutbound` extract = **behavior** — smoke after.  
3. P2 budgets only with before/after product.ok.

### Log

- 2026-08-12: UI A–D + Lane E mess map on spec.
- 2026-08-14: herd `20260814T020528Z` P0 + P1 inventory; Claude 479 tests; no APK.
