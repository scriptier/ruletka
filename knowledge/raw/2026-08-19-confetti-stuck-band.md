# Raw: 2026-08-19 confetti stuck band (PC)

Source: ~/Pictures/2026-08-19_21-25.png (human, mid-match Courtier / Calgary).
Immutable original also: knowledge/raw/2026-08-19-confetti-stuck-band.png

What: colorful confetti bits frozen in one horizontal line ~⅓ down partner tile. Mute overlay center. Gift timer “11s · +15s = 5★”. Not falling.

Cause: prod live-stage.css?v=561 keyframes animate `top` while transform Y stays 0 (gotcha 67). Disk 564/565 is transform-only 0px→130vh. Needs **deploy**. Do not invent GOAL_MET.
