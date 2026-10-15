# 454 — FriendChatSheet bubbles → Signal-ish (residual)

## Status
COMPLETE

## Files touched
- `mobile/src/friends/FriendChatSheet.tsx`

## Changes
- Outgoing bubbles: solid soft blue `#3d7eff`, white text (`bubbleTextMe`), semi-white timestamp (`bubbleTsMe`).
- Incoming bubbles: solid dark gray `#1c212b`, light text (`bubbleTextThem`), muted timestamp (`bubbleTsThem`) — unchanged colors from before but now split from the `mine` bubble so each side can diverge.
- Bubble corner radius bumped from 14 → 18 (Signal spirit).
- Long-press-to-copy (Clipboard + toast + haptic) and `accessibilityRole`/`accessibilityLabel` on bubbles untouched.
- Compose row made taller (`input` paddingVertical 10 → 13, `compose` gets `alignItems: "center"`) and the send button is now a 46×46 circular icon button (`Ionicons name="send"`) instead of a text pill; kept `accessibilityRole="button"`, `accessibilityLabel`, and `accessibilityState` disabled wiring.
- Removed now-unused `sendText` style.

## Verify commands run
- `npx tsc --noEmit -p .` (mobile/) — pre-existing unrelated errors only (missing `node_modules` packages like `expo-clipboard`, `react-native-gesture-handler`, etc., and pre-existing `live.tsx`/`SwipeSkipOverlay.tsx` errors); no new errors introduced by this change, and no stale references to removed style names (`bubbleText`, `bubbleTs`, `sendText`) remain in the file.

## Connect risk
none — no touches to `friends.tsx`, MediaSession, live, or hub. Pure styling/markup change inside `FriendChatSheet.tsx`.

COMPLETE
