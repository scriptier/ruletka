---
title: 3-way Android + laptop + PC partial connect
date: 2026-08-14
slug: 3way-android-laptop-pc-partial
source_type: note
source_url:
source_path:
captured_by: human
skill: add-new-resource
---

# Raw: 3-way Android invite → laptop accepted → partial mesh

## Source
- Type: human desk smoke (chat)
- Captured: 2026-08-14

## Original (untouched)

on android invite for 3rd way works and laptop pc accepted it, once we connected to pc browser heres the result. on android it started off with split screen but when connected 3rd i only see laptop browser window on android. on laptop browser i see proper tiles, i see video of android but i dont see video from pc browser. on pc browser i see black screen for conversationalist i dont think 3rd fully connected because the tiles didnt split in to 3way

## Surfaces (as stated)

1. Android (inviter): hunt split OK → after 3rd joins, only laptop window (lost first conversationalist)
2. Laptop browser (3rd): tiles look right; sees Android; no video from the other PC
3. PC browser (original pair): black conversationalist; still 1v1 (no 3-col split)

## Notes

- Unverified hub/scorecard. **No MULTI_PASS.**
- Disk live.js 621 `clearStaleTrioOnPair` could `enableTrioLayout(false)` while 3rd still connecting (people=2, searching already off). Tightened in 622.
- Android 0.1.392 / vc400 — remount on 3rd join is skill gotcha 1; no APK this hop.
