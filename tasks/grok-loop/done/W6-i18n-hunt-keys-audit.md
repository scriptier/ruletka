# W6 hunt caption i18n key audit

## Goal
PC+Android hunt captions resolve i18n (no raw keys on UI).

## OWN
- RESULT only preferred; if missing key in en.json only: mobile/src/i18n/packs/en.json OR ui/i18n/en.json (one file)

## Work
1. Grep trio.slotEmpty lookingForThird captions.
2. RESULT. Minimal en key only if missing.
3. COMPLETE. No full pack thrash.

## Must not
Deploy, APK, all-locale thrash
