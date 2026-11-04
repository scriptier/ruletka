---
title: Laptop console — remount #remote after inbound frames
date: 2026-08-16
slug: laptop-console-remount
source_type: paste
captured_by: human
skill: add-new-resource
---

# Raw: laptop console remount

## Original

User pasted laptop Chrome console (live.js 668 / webrtc 332):

- av_path connected relay→relay fin↑ (8…1407) fout=0 ok=0 (honest no-cam send)
- multi-cam heal GUM fail NotFoundError (laptop has no webcam)
- blank@3s inbound frames=48 bytes=109774 ice=connected
- remount #remote (blank@4s) stream=1
- play() AbortError interrupted by new load
- name=Dragonov from=dc slot=remote-third; skip-main (keep Courtier)
- rate limited chat too fast (identity flood)

**No MULTI_PASS.**
