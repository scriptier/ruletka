---
title: Let's go remounts Live into solo search
date: 2026-08-15
slug: lets-go-solo-search
source_type: screenshot
source_path: artifacts/shots/20260815T054049Z-hunt401-phone.png
captured_by: agent
skill: add-new-resource
binary_inlined: false
---

# Raw: Let's go remounts Live into solo search

## Human
no, as soon as android user presses lets go on pc browser conversationalist freezes and on android it removes original conversationalist while we look for 3rd

## Shots
- Phone `052135` wait `054049Z-hunt401-phone`: Looking 128s, first in line, brand loop, PiP self. Solo queue — not hunt-with-partner.
- CDP `0541-hunt401-cdp1`: PC 2-col hunt banner "Looking for a 3rd together". Courtier last-frame frozen. Dragonov live (Hide). tile-third hidden.

## Cause
`MatchLiveNavigator` `router.replace("/live")` on every Matched. find-3rd Let's go re-sends Matched party_browse → remount Live → `media.close()` → Courtier freeze + remount search.

## Fix (disk)
`shouldNavigateToLive` — skip replace/push when pathname is already `/live`.
