---
title: 3rd not linking — pair hunt + phone solo first-in-line
date: 2026-08-14
slug: no3rd-linking
source_type: screenshot
source_path: artifacts/shots/20260814T032707Z-no3rd3-pc.png
captured_by: agent
skill: add-new-resource
---

# Raw: 3rd not linking — 2026-08-14T03:27:07Z

**Verdict: FAIL · NO MULTI_PASS**

Immutable dump. Do not invent MULTI_PASS / product.ok / GOAL_MET.

## Shots

- Phone: `artifacts/shots/20260814T032707Z-no3rd3-phone.png` — solo queue **Looking · 5s** / **You're first in line**
- PC: `artifacts/shots/20260814T032707Z-no3rd3-pc.png` — Firefox trio **Looking for a 3rd** + strip **Your pair · vs their pair** (partner Dragonov live); Chrome **Add as friend? Dragonov** / Start (match ended)

## Diagnosis (director)

1. Hub can match solo→hunting pair (`start_party_vs_solo`). Phone waiting + pair hunting should match unless pair is already Matched (2v2 strip) or same-identity kick.
2. Web: `handleMatched` called `setThirdSlotStream(null)` after async `joinPeers` → hunt brand + `forceThirdBrandLoop` **nulls `#remote-third`** while 3rd ICE is gathering. Matches earlier no3rd2 (Firefox “You vs a pair / Linking cameras”, Chrome still hunting).
3. Installed APK **0.1.376/vc384** lacks disk hunt-keep (`live.tsx`).
4. Hub `handle_hello` kicks previous connection for the same `user_id` — two live.html tabs as Драконов cannot be two people.

## Hop after this dump (disk only)

- `ui/live.js` `showThirdConnecting` · pin **`live.js?v=578`**
- `node --check ui/live.js` ok
- No deploy · no APK · no MULTI_PASS
