# RESULT — 100-ios-app-privacy-doc

**Status:** Done

## Files touched

- `docs/IOS_APP_PRIVACY.md` (new) — full Apple App Privacy nutrition-label draft, mirrors
  `docs/PLAY_DATA_SAFETY.md` structure (Collected? / Linked? / Tracking? / Purpose per data type),
  covers identifiers, camera/mic (live-only, not stored as files), optional report screenshots,
  optional chat text, optional diagnostics/analytics, and explicit "No" sections for
  Contacts/Location/Financial/Health.
- `mobile/assets/store/ios/APP-PRIVACY.md` (new) — condensed paste-ready version referencing the
  full doc, for direct use while filling the App Store Connect form.

## Verify commands run

- Read-only doc task; no code changed. Reviewed source docs for consistency:
  `docs/PLAY_DATA_SAFETY.md`, `docs/STORE.md`, `docs/IOS_APP_STORE.md`.
- No `mobile/` app.json / build config / MediaSession / live.tsx touched (out of scope, respected).

## Connect risk

**none** — docs only, no code or config changes, no ICE/TURN/offer path touched.

## Notes

- Tracking answer is **No** across the board — no ATT prompt, no ad/tracking SDKs, matching
  Play's "not sold to data brokers / ads" stance.
- Camera/mic/chat/report data declared **linked to user** (tied to on-device `user_id`), not
  anonymous — mirrors the honesty bar `STORE.md` already sets for Play ("don't claim anonymous
  absolute").
- Diagnostics/analytics kept optional per existing product stance (minimal analytics, no
  third-party ad SDKs).

COMPLETE
