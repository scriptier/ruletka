# Spec: iOS App Store (same Expo app as Android)

> Karpathy Layer 1. **Not** a Swift rewrite. Ship the existing `mobile/` Expo app to Apple.

```text
GOAL: ruletka on the Apple App Store does the same job as Play/Android:
      18+ P2P video chat, Start/Stop/Next, friends, block/report, stars.
DONE WHEN:
  - EAS can produce an iOS production IPA (config + listing pack in repo)
  - App Store listing copy + privacy/usage strings exist (EN)
  - iOS camera/mic/audio/push gaps vs Android are documented + code-fixed where OWN allows
  - Human: Apple Developer + App Store Connect + TestFlight smoke on a real iPhone
EVAL:
  - mobile/eas.json submit.ios has a real ascAppId OR a clearly marked REPLACE + how-to
  - app.json / app.config.js: ITSAppUsesNonExemptEncryption, camera/mic strings, background audio if needed
  - docs/IOS_APP_STORE.md exists with human checkpoints (account, 17+, TestFlight)
  - units: node scripts that already exist still pass; no MediaSession thrash
CHECKPOINTS (human):
  - Apple Developer Program ($99) is yours
  - Create App Store Connect record; paste ascAppId
  - EAS credentials / Apple login — not Grok/Claude unsupervised
  - TestFlight install + Play↔iPhone A/V smoke
OUT OF SCOPE:
  - Swift rewrite / second native codebase
  - SFU, pool>0, always-on force_relay
  - Play upload, website APK, hub deploy
  - Claiming App Store APPROVED without Apple
VERIFY:
  - Baseline: grep me.ruletka.app, eas.json ios, STORE.md
  - After: docs/IOS_APP_STORE.md + listing files + config keys
  - Second critic: Claude read-only after implement lanes
LANE: general (Claude factory). Grok: shepherd, no dual-write.
OWN FILES: per-task (non-overlapping)
MUST NOT: MediaSession.ts, ui/webrtc.js, pool>0, push.sh, git push, invent GOAL_MET
MAX HOPS: config + listing + iOS platform gaps; IPA only via EAS when human logs in
```

### Reality (Linux director box)

This machine **cannot** run Xcode. IPA = **EAS cloud** or a Mac. Claude fills repo. You tap EAS/App Store.

### Tools (2026-08-25)

| Tool | Status |
|------|--------|
| Node 20 + npm | installed |
| **eas-cli 22.4.0** (global) | installed; Expo login **courtier** / yanesplu@gmail.com |
| eas-cli 16.28.0 (mobile devDependency) | pinned for `npx eas-cli` in `mobile/` |
| Expo 52 in `mobile/` | do **not** bump to Expo 57 |
| Pillow (store assets) | installed |
| libimobiledevice (`idevice_id`) | already on box |
| Xcode / CocoaPods / Transporter | **Mac only — cannot install here** |

```bash
cd mobile
eas whoami
# when Apple app exists + 2FA:
# eas build --profile production --platform ios
# eas submit --profile production --platform ios
```

### Status

- **Active** (2026-08-25)
- Expo already has `ios.bundleIdentifier: me.ruletka.app`, deploymentTarget 15.1, WebRTC plugin permission strings.
- `eas.json` `submit.ios.ascAppId` = **6804910924**.
- First EAS iOS IPA submitted: build `5cb83fad` → ASC TestFlight **0.1.476 (3)**. Processing 2026-08-25. Human: testers + 17+ listing + TestFlight smoke.
