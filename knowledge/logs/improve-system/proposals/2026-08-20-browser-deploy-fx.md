# improve-system proposals — 2026-08-20 browser deploy / gifts

Session pain: balloons frozen + avatar ★ gift “not done” while disk was 10 pins ahead of prod **842**. Optimistic comet. UI-only spend without mint. “still nothing” loop.

### P1: Prod pin check before more browser hops
WHY: User said “nothing changed” / “balloons not moving” ~8 times. Agent kept editing disk. Curl showed **561/842** the whole time.
WHERE: `AGENTS.md` Always table; `.grok/skills/agentic-engineering/SKILL.md`
CHANGE: One Always line: if human says browser/FX/live “not working / nothing changed”, **curl `https://ruletka.vip/live.html` pins vs `ui/live.html` before another live.js hop**. Disk≠prod → stop coding, ask deploy.
RISK: low
APPROVE?: pending

### P2: Gift FX never CSS `top`+`transform`; canvas/WAAPI is the browser path
WHY: Gotcha **67** smoked only after canvas + deploy. CSS interpolable keyframes were not enough on Chrome.
WHERE: `knowledge/wiki/gotchas.md` (already 67); new tiny skill **gift-fx** or a paragraph under live-chrome-ux skill if none — prefer **AGENTS Prefer editing** + `knowledge/wiki/live-chrome-ux.md` one lock line
CHANGE: Browser particles: **canvas or WAAPI pixel travel**. Never animate `top`/`left`/`bottom` with `transform`. Android: never `left`/`top` on the same Animated.View as native `transform`.
RISK: low
APPROVE?: pending

### P3: Star spend — no celebrate until `star_effect` ok
WHY: Fake comet then “doesn’t minus”; then we hid failures → “nothing happens”. 10s gift lock hid retries.
WHERE: `ui/live.js` already waits on 853; encode in wiki/gotcha **69** so next agent doesn’t optimistic-toast again
CHANGE: Gotcha: never `showStarGiftedPopup` before hub ok. Toast failures. Avatar tap skip 10s lock. Wallet gifts (`gift:`) need **hub binary** not UI-only rsync.
RISK: low
APPROVE?: pending

### P4: Treat “proceed” / “still nothing” after an explicit deploy ask as UI deploy yes
WHY: Agent asked for the exact word `deploy` while user was already authorizing the outcome. Hours of dead hops.
WHERE: `AGENTS.md` Ask first row (production push)
CHANGE: If the last agent message asked “type deploy” and the user says **proceed / still nothing / do it**, that **is** UI-only rsync authorization. Full `push.sh` + hub restart still needs **deploy** or **hub** explicitly.
RISK: med (don’t treat random “proceed” as coturn/hub)
APPROVE?: pending

### P5: now.md pins must match `ui/live.html` after any UI rsync
WHY: now.md still said “DEPLOY 851 / prod 842” after 854 was live.
WHERE: `knowledge/wiki/now.md`; optional one-liner in deploy notes
CHANGE: After UI rsync, update now.md Pins + Next in the same turn (version string only, ≤25 lines).
RISK: low
APPROVE?: pending
