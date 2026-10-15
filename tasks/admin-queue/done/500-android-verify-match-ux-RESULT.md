# RESULT: Verify mobile match-ux + connect-ui

## Status
BLOCKED on script exit code, but investigation shows product code is correct — the failing check is stale in the verify script itself. No product code was changed (RESULT-only task).

## Files touched
None (read-only verification task).

## Verify commands run

```
cd mobile && node scripts/verify-match-ux.mjs
```
Exit code: **1** (FAIL) — 30 ok, 1 fail.

Failing check: `multi-tile blur remote2/3 (A5)` (mobile/scripts/verify-match-ux.mjs:263)

```
cd mobile && node scripts/test-connect-ui.mjs
```
Exit code: **0** (OK) — `test-connect-ui: ok (real module)`

## Investigation of the verify-match-ux.mjs A5 failure

The A5 check (mobile/scripts/verify-match-ux.mjs:232-267) anchors a text slice on
`stage.indexOf("multiRemote ?")` and looks for an end marker `"1v1 OR find-3rd"`
(mobile/scripts/verify-match-ux.mjs:236-237). That end-marker comment no longer exists
in `mobile/src/live/LiveStageVideo.tsx`, so the script falls back to a fixed 9000-char
window (mobile/scripts/verify-match-ux.mjs:242). That window starts at line ~632
(an unrelated `brandLoop || multiRemote ? localStream : pipStream` expression) and only
reaches to ~line 881 — it never reaches the actual multi-tile privacy-blur logic.

The real remote2/remote3 tile logic lives in:
- `ExtraRemoteTile` component definition: mobile/src/live/LiveStageVideo.tsx:265-380
  (before the script's slice start, so also missed)
- Its two call sites: mobile/src/live/LiveStageVideo.tsx:1125-1158 (`remoteStream2`)
  and mobile/src/live/LiveStageVideo.tsx:1159-1189 (`remoteStream3`) — both after the
  script's slice end, so also missed.

Reading that component directly confirms the A5 invariant the check wants IS satisfied:
- `zOrder={0}` is unconditional for every remote tile's `VideoView`
  (mobile/src/live/LiveStageVideo.tsx:323) — not gated on any `idx===0`-style condition;
  each of remote2/remote3 is its own component instance, no shared `idx` gate exists.
- `privacyBlur ? ... : ...` (mobile/src/live/LiveStageVideo.tsx:331) wraps a
  `PartnerBlurVeil` (mobile/src/live/LiveStageVideo.tsx:352) inside a
  `styles.blurCoverElevated` view (mobile/src/live/LiveStageVideo.tsx:334, :347) — applied
  per-tile via the `privacyBlur` prop passed at both call sites
  (mobile/src/live/LiveStageVideo.tsx:1148, :1180).

Conclusion: this looks like a **false positive** — the verify script's regex/slice
logic is stale relative to a since-renamed/removed comment marker, not a real privacy
regression in product code. Per task scope (RESULT only, do not change product code or
scripts), I did not edit `verify-match-ux.mjs` to fix the anchor/window logic.

## Connect risk
**none** — read-only verification, no edits made; investigation indicates the underlying
multi-tile privacy blur (connect-adjacent UX, not ICE/offer/TURN) is intact in product code.

## Recommendation for Grok / next task
Update the A5 check's end-marker in `mobile/scripts/verify-match-ux.mjs:237` (or restructure
it to search from the `ExtraRemoteTile` function/usages directly) so it inspects the correct
code region.

COMPLETE
