---
title: 3-way Android fout=0 PiP black
date: 2026-08-16
slug: 3way-android-fout0
source_type: note
captured_by: human
---

# Raw: 3-way Android camera dead

Human live: PC + Spain 1v1 then Android 3rd. PC/Spain cannot see Android. Android sees 2 remotes. Android PiP (front cam) black.

Score `203759Z`: leftover product.ok is **web↔web**. android both PCs ice=connected bind_v=1 enc_active=1 v_readyState=live **frames_encoded=0 frames_out=0**. answers 3<2 offers.

Cause: `refreshLocalVideoTrack` skipped GUM when `multiPeerAudio` even on `zero_f_*`.

Disk hop: primary GUM on zero_f; extras re-adopt. **Needs APK.** **No MULTI_PASS.**
