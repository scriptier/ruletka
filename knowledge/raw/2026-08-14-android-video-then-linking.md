---
title: Android camera then Partner video shown then Linking then black
date: 2026-08-14
slug: android-video-then-linking
source_type: note
source_path: chat
captured_by: agent
---

# Raw: Android first paint then extra steps then black

Human (verbatim sense): on Android it showed the conversationalist camera, then went to “Partner video shown” but without video, then “Linking cameras…”, then black. It did load video instantly; feels like video is behind extra steps or starts then stops.

Not a scorecard. Not product.ok. Not GOAL_MET.

Diagnosis (disk, 2026-08-14): `startCall EARLY` paints first; same `Matched` still `keepPrimary=false`; intro veil + SoftBlur sink + `setConn(connecting)` + peel toast + optional stream null/repaint tears the tile.

Spec: `knowledge/specs/2026-08-14-android-first-paint.md`
Gotcha: wiki/gotchas.md §45
