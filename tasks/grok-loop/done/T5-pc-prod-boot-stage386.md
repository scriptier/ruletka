# T5 PC prod live.html boot + stage version

## Goal
Short Chromium boot prod live.html; note live.js/webrtc/stage ?v= vs disk (disk stage 386).

## OWN
scripts/phone-web-pair.mjs short BUDGET only. RESULT COMPLETE. No phone adb. No deploy.

## Work
1. BUDGET_MS=20000 CHROME=/usr/bin/chromium node scripts/phone-web-pair.mjs
2. curl prod live.html for ?v= pins; compare ui/live.html disk
3. RESULT COMPLETE. No invent GOAL_MET.
