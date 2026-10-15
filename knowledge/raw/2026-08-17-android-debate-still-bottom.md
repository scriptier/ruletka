---
title: Android debate invite still under Stop/Next
date: 2026-08-17
slug: android-debate-still-bottom
source_type: screenshot
source_path: artifacts/shots/20260817T162552Z-android-debate-still-bottom.jpg
captured_by: human
skill: add-new-resource
---

# Raw

Phone 16:25. Formal debate? card at bottom. Stop/Next/PiP cover Decline/Accept. No dim overlay (old 422 card or nested Modal failed).

Fix: DebateIncomingOverlay at live.tsx root, full-screen center, not Modal in stage.
