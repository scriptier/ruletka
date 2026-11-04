# RESULT: 861 — Apple age-rating questionnaire draft (17+)

**Status:** Done

**Files touched:**
- `mobile/assets/store/ios/AGE-RATING.md` (new) — YES/NO + descriptor answer key for the ASC Age Rating questionnaire.

**Summary:**
Drafted an answer key for App Store Connect's Age Rating questionnaire covering both the classic descriptor grid (Violence, Profanity, Mature/Suggestive Themes, Alcohol/Tobacco/Drug, Simulated Gambling) and the Yes/No questions (Gambling, Contests, Unrestricted Web Access, UGC, chat/messaging, content moderation, block/report). Mature/Suggestive Themes and UGC/chat are called out as Frequent/Intense + Yes, driving the expected **17+/18+** result, consistent with `mobile/assets/store/ios/LISTING.md`'s existing "Age rating (expect 17+)" note. ★ stars are explicitly answered as not gambling/IAP (free cosmetics only, no purchase or cash-out), per spec's "no gambling IAP" requirement.

**Verify commands run:**
- None applicable (docs-only change, no code/build affected). Confirmed no other file references `AGE-RATING.md` that would need updating (`grep -rn AGE-RATING mobile/ docs/`) — none found, so this is a standalone new reference doc.

**Connect risk:** none — doc-only, no touch to app code, eas.json, MediaSession, webrtc, or ICE/TURN.

COMPLETE
