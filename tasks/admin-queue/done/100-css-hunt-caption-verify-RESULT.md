# RESULT: verify stage hunt caption CSS on disk

**Status:** COMPLETE

## Findings
- `ui/live.html:1007-1030` — `#tile-third` → `#third-empty` markup exists and is well-formed:
  `.empty-bg-video` (brand loop) + `.empty-bg-scrim` + `.empty-content > .empty-icon + .empty-title`
  (`data-i18n="trio.slotEmpty"`, text "Looking for a 3rd…").
- `ui/live-stage.css:2202-2245` — `.stage.stage-trio .third-empty` stack is layered correctly:
  poster `z-index:0` → brand video `z-index:1` → scrim `z-index:2` → `.empty-content` `z-index:3`
  (`position: relative`), so the caption/title always paints above the loading-screen video/poster.
- `ui/live-stage.css:20322-20338` — `#third-empty[hidden]` and
  `.tile-third:has(#remote-third:not([hidden])) .third-empty` both force
  `display:none / visibility:hidden / opacity:0 / z-index:-1`, so the caption never covers a live
  third stream (belt-and-suspenders against JS lag on the `[hidden]` attr).
- Generic `.empty-title` typography (`live-stage.css:3690`, plus responsive overrides at 6927/7187)
  applies to `#third-empty .empty-title` since no dedicated override exists or is needed — it inherits
  cleanly.
- No dedicated min-height/min-width "floor" rule scoped to `.third-empty .empty-content` itself, but
  the parent trio columns already get non-collapsing floors at `live-stage.css:2274-2276`
  (`min-width: max(6.5rem, 18%)`, `min-height: max(10rem, 40%)` on `#tile-third` during
  `.stage-trio-searching`), which is what keeps the empty-title caption from being squeezed to zero.

## Discrepancy (not fixed — flagging only)
- Task expected `live.html` to reference `live-stage.css?v=386`. Current working tree
  (`ui/live.html:395`) has `?v=385` (bumped from committed `?v=359`, per `git diff`, likely mid-flight
  from Grok's tree). Left untouched — version bump is Grok's to own; not touching per task scope
  ("Only edit if missing and not dual with Grok"), and CSS content is otherwise present and correct
  regardless of the query-string number.

## Files touched
None (read-only verification).

## Verify commands run
- `git -C /home/drakosik/freenet-roulette-claude log -3 --oneline -- ui/live-stage.css ui/live.html`
- `git -C /home/drakosik/freenet-roulette-claude diff --stat -- ui/live.html ui/live-stage.css`
- `grep`/`Read` inspection of `ui/live.html` and `ui/live-stage.css` (no shell mutation)

## Connect risk
none — read-only verification, no edits made, no ICE/offer/TURN/CONNECTIVITY_LOCK code touched.

COMPLETE
