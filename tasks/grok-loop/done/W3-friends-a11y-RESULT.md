# W3 Friends a11y labels — RESULT

## Status
**COMPLETE**

## OWN
- `mobile/app/friends.tsx` only (no APK, no i18n edits — reused existing keys)

## What changed
Minimal `accessibilityLabel` / role polish so primary Friends CTAs are screen-reader labeled:

1. **Empty state Share + Copy**
   - Empty list now shows both **Share invite** and **Copy code** (hero action row).
   - Both buttons: `accessibilityRole="button"` + labels via `mobile.friends.shareInvite` / `mobile.friends.copyCode`.
   - Empty summary keeps `accessibilityLabel={t("mobile.friends.empty")}`.

2. **Incoming / outgoing requests**
   - Accept → `friends.accept`
   - Decline → `friends.declineReq`
   - Cancel outgoing → `mobile.common.cancel`

3. **History clear links**
   - Clear matches → `mobile.history.clearMatches`
   - Clear call history → `mobile.history.clear`

4. **Match-history CTAs**
   - Row long-press target labeled with name + meta; hint = copy code when present.
   - Add friend / Copy code / Report / Block / Dismiss each get role + label (existing i18n keys).

5. **Already labeled (unchanged)**
   - Friend row avatar/main/Chat/Call|Invite/⋯
   - Hero code / Share / Copy / Add / Search / call-history Call back|Ring anyway

## Files
- `/home/drakosik/freenet-roulette/mobile/app/friends.tsx`

## Verify
- All 24 `<Pressable>` openings in `friends.tsx` have `accessibilityLabel`.
- Styles reused: `heroActions`, `shareBtn`, `copyBtn` (already defined).
- No new i18n keys; no APK.

## Connect risk
**None** — a11y props + empty-state Copy CTA only. No WebRTC / hub protocol / MediaSession changes.

## Out of scope
- APK / AAB
- FriendChatSheet / settings a11y
- Full Play empty-card redesign (title card, loading/error strips)
