# RESULT — 865 iOS Export compliance one-liner for TestFlight

**Status:** Done

**Files touched:**
- `mobile/assets/store/ios/EXPORT-COMPLIANCE.md` (new)

**Note on spec path:** Task cited `knowledge/specs/current-ios-app-store.md`, which does not exist in this worktree (`knowledge/specs/` only has `2026-08-20-ru-reach.md`). Used the task's own Goal text plus `mobile/app.config.js:77,81` (`ITSAppUsesNonExemptEncryption: false` / `usesNonExemptEncryption: false`) as source of truth instead, consistent with how prior task 864 handled the same missing-spec situation.

**Content:** Documents answering **No** to both TestFlight export compliance questions (uses encryption / designed to use cryptography), on the grounds that HTTPS and WebRTC DTLS/SRTP are standard exempt encryption, no custom crypto is implemented, so `ITSAppUsesNonExemptEncryption` stays `false` and no ERN/CCATS filing is needed.

**Verify commands run:** none applicable (doc-only change, no code/build affected).

**Connect risk:** none — docs-only, no touch to app code, eas config, deploy, or CONNECTIVITY_LOCK.

COMPLETE
