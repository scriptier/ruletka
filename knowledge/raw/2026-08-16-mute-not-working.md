---
title: Mute mark not visible — Courtier add-friend sheet
date: 2026-08-16
slug: mute-not-working
source_type: screenshot
source_url:
source_path: /home/drakosik/Pictures/2026-08-15_21-14.png
captured_by: human
skill: add-new-resource
binary_inlined: false
---

# Raw: Mute mark not working

## Source
- Path: `/home/drakosik/Pictures/2026-08-15_21-14.png`
- Human: “not working” after mute-icon hop (stage 457)

## Description

- Post-tap / post-match “Add as friend?” for Courtier (C · 🇨🇦 · 13s).
- No mute mark visible. Mid-tile is typically no-cam (portrait z=6 covers ::before z=6).

## Likely cause

`.peer-slot-muted::before` z-index 6 sits under `#third-no-cam` z-index 6. Partner sheet also covers tile center.
