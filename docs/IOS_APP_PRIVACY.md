# Apple App Privacy (nutrition label) — draft answers

Use while filling **App Privacy** in App Store Connect for `me.ruletka.app`.
Mirrors [`PLAY_DATA_SAFETY.md`](PLAY_DATA_SAFETY.md) — keep both in sync with
https://ruletka.vip/legal/privacy.html. If the privacy policy text changes, update this file too.

Apple's App Privacy questionnaire asks, per data type: **Collected?** → **Linked to the user?**
→ **Used for tracking?** → **Purpose(s)**. Answers below follow that shape.

## Top-level: "Data Used to Track You"

**No.** ruletka does not link data collected from this app to third-party data for advertising,
and does not share data with data brokers. Answer **"No, we do not use data for tracking
purposes"** on the App Tracking Transparency-adjacent tracking question — no `NSUserTracking`
usage description is needed, no ATT prompt.

## Data types

| Apple category | Collected? | Linked to identity? | Used for tracking? | Purpose(s) | Notes |
|---|---|---|---|---|---|
| **Identifiers** — Device ID / User ID | Yes | Yes | No | App Functionality | App-generated `user_id` (on-device identity, no email/phone signup); used for matching, Friends, Stars on the hub. |
| **Contact Info** (name, email, phone, address) | No | — | — | — | No account/signup; no contact fields collected. |
| **Audio Data** — Microphone | Yes (live only) | Yes (tied to session/user id during a call) | No | App Functionality | Live WebRTC stream to the matched call partner only. Not recorded or stored as a file by the hub. |
| **Photos or Videos** — Camera | Yes (live only) | Yes (tied to session/user id during a call) | No | App Functionality | Live WebRTC stream to the matched call partner only; not uploaded/stored as a file by default. |
| **Photos or Videos** — User-submitted (Report) | Optional | Yes | No | App Functionality (Safety) | Only if the user attaches a screenshot when filing an abuse Report; sent to hub admin review. |
| **User Content** — Other (chat messages) | Optional | Yes | No | App Functionality | In-call/Friends text chat, when used; relayed by hub, P2P where possible. |
| **Diagnostics** — Crash Data, Performance Data | Optional (Play/App Store vitals; not third-party ads SDK) | No | No | App Functionality (Analytics) | Standard OS-level crash/perf reporting only; keep minimal, no ad SDKs. |
| **Usage Data** — Product Interaction | Optional | No | No | Analytics | Only if/when in-app analytics is enabled; not required for core chat. |
| **Location** — Precise or Coarse | No | — | — | — | Not collected. Don't answer this section unless geo features ship later. |
| **Contacts** | No | — | — | — | App does not access the device address book. |
| **Financial Info** (payment, purchase history) | No | — | — | — | "Stars" are free in-app cosmetics — no IAP, no payment collection. |
| **Health & Fitness** | No | — | — | — | — |
| **Browsing History / Search History** | No | — | — | — | — |

## Purposes (Apple's fixed list) to select

- **App Functionality** — camera/mic streaming, identifiers for matching/Friends/Stars, optional
  chat text, abuse-report screenshots.
- **Analytics** — only if/when optional product-interaction analytics is enabled; otherwise omit.

Do **not** select: Third-Party Advertising, Developer's Advertising or Marketing, Personalization,
Product Personalization tracking — none apply.

## "Data Not Linked to You" vs "Data Linked to You"

Camera/mic/chat/report data is tied to the active call/session and the on-device `user_id`, so
declare it **linked to the user** rather than anonymous — same honesty bar as the Play form's
"don't claim anonymous absolute" note in `STORE.md`.

## Security practices to state

- All network traffic encrypted in transit: HTTPS/WSS signaling + WebRTC DTLS-SRTP media — **Yes**.
- Users can request account/data deletion: **Yes** — https://ruletka.vip/legal/delete.html +
  in-app Settings.
- Data is **not sold** to data brokers or third parties.
- No advertising or tracking SDKs are integrated.

## Reviewer / age context

- App is gated **18+** in-app before camera access (`mobile/app/rules.tsx`); cite this if Apple's
  privacy reviewer asks how the app avoids collecting minors' data.
- Matches [`IOS_APP_STORE.md`](IOS_APP_STORE.md) §4 age rating and §7 review notes.

## Paste-ready summary

See [`mobile/assets/store/ios/APP-PRIVACY.md`](../mobile/assets/store/ios/APP-PRIVACY.md) for the
condensed version to paste directly into App Store Connect's form.
