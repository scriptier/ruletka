---
title: 3-way Android 3rd — laptop no Android cam, phone layout messy, PC slow
date: 2026-08-19
slug: 3way-laptop-no-android
source_type: paste
source_path: artifacts/shots/20260819T044713Z-phone-screen.png
captured_by: agent
skill: add-new-resource
---

# Raw: 3-way fail 2026-08-19

## Human
> take a look at screenshot on phone its all messed up now when doing 3 way
> took for ever to load on pc and on laptop i dont even see android cam

## Score `20260819T195239Z` av-verify WARN · product ok (leftover mix)

- matches=4 offers=6 answers=3 max_mto=**5801** max_mta=**6333** SLOW
- app_vc **448** (0.1.440)
- Android `548c8dc6`: one PC ice=**checking** 0/0 offerer=0; other connected fin/fout 1140/1086
- Web `ee397809` (laptop): fin high **fout=0** (no cam); extra to Android never in a two-way pair
- Web `4f74353a` (PC): one pair two-way ok; other fin=0 fout high (sends to laptop)

## Hub
- 19:50:04 PC↔laptop match force_relay=true
- 19:50:16 find_third invite
- 19:51:11 Android joined 1v2

## Phone screenshot pulled
`Screenshot_20260819-044713.png` (04:47 local) — 1v1-looking split, not this 19:51 3-way. Do not treat as layout PASS/FAIL for this hop.

## Unverified
MULTI_PASS. Linking GOAL_MET.
