# Gift FX: trim fireworks node count for mid-range phones

## Goal
Read-only audit 211 said fireworks ~83 animated nodes. Cut burst/sparks ~25–35% without looking dead.

## OWN
- mobile/src/stars/GiftFxOverlay.tsx fireworks only (fireworkBursts / nSparks / floatSpecs count for fireworks layer)

## Do
1. Reduce centers from 7→5 or sparks per burst by ~3
2. Keep multi-color radial feel
3. No other gift layers unless needed for compile

## Must not
- Deploy, APK, ICE

## Done
RESULT with before/after counts + COMPLETE
