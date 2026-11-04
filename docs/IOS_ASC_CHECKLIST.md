# App Store Connect — Submit for Review checklist (human)

TestFlight target **0.1.480** (EAS production, autoIncrement). Human still owns **Submit for Review**. This is the remaining
human-only path through App Store Connect to **Submit for Review**. Do **not** treat any step
below as done until a human has clicked it in ASC — this doc does not claim Review was submitted.

Companion docs: [`IOS_APP_STORE.md`](IOS_APP_STORE.md) (full runbook),
[`IOS_APP_PRIVACY.md`](IOS_APP_PRIVACY.md) (privacy answers),
[`mobile/assets/store/ios/LISTING.md`](../mobile/assets/store/ios/LISTING.md) (copy to paste),
[`mobile/assets/store/ios/SCREENSHOTS.md`](../mobile/assets/store/ios/SCREENSHOTS.md) (shot list).

Go to appstoreconnect.apple.com → **Apps** → **ruletka** (`me.ruletka.app`, App ID `6804910924`).
Work top to bottom; each section below is one ASC left-nav item.

## 1) App Information

- [ ] Name: `ruletka` (fallback `ruletka video chat` if taken — see `LISTING.md`).
- [ ] Subtitle: paste from `LISTING.md` → **Subtitle** (`P2P video chat. 18+.`).
- [ ] Category: primary **Social Networking** (or **Lifestyle** if Social Networking triggers
  extra UGC scrutiny you want to avoid first pass — human judgment call, not scripted here).
- [ ] Content rights: confirm "does not contain third-party content" (or answer per actual
  assets — icon/screenshots are original).
- [ ] Age rating: **do not set here** — it lives in its own **App Privacy → Age Rating**
  questionnaire (§4 below); this page just shows the computed result afterward.

## 2) Pricing and Availability

- [ ] Price: **Free**.
- [ ] Availability: all territories, or restrict per legal/compliance decision (human call).
- [ ] Pre-orders: off (not applicable for first release).

## 3) Prepare for Submission (version page) — metadata

- [ ] Promotional text: paste from `LISTING.md` (≤170 chars).
- [ ] Description: paste from `LISTING.md` → **Description**.
- [ ] Keywords: paste from `LISTING.md` → **Keywords** (≤100 chars).
- [ ] Support URL: `https://ruletka.vip/safety.html`
- [ ] Marketing URL (optional): `https://ruletka.me`
- [ ] Version (What's New): paste from `LISTING.md` → **What's New** (first TestFlight text).
- [ ] Copyright: current year + legal entity/name.
- [ ] Build: select **0.1.480** (latest processed TestFlight) — not 0.1.477/478.

## 4) Age Rating

Answer the questionnaire per [`IOS_APP_STORE.md`](IOS_APP_STORE.md) §4:

- [ ] Mature/Suggestive Themes: **Frequent/Intense**.
- [ ] User-generated content: **Yes**.
- [ ] Unrestricted web access: **No**.
- [ ] Contests: **No**.
- [ ] Simulated gambling: **No** (Stars are free, non-wagered, no IAP).
- [ ] In-app purchases: **No**.
- [ ] Confirm computed result lands at **17+** (Apple's ceiling below "Adults Only 18+", which
  Apple reserves for itself — 17+ is the correct target, matches `LISTING.md`'s "expect 17+").

## 5) App Privacy (nutrition label)

Full answer key: [`IOS_APP_PRIVACY.md`](IOS_APP_PRIVACY.md). Walk each data type in ASC's
**App Privacy** page and match that doc's table:

- [ ] "Data Used to Track You": **No**.
- [ ] Identifiers (Device/User ID): **Yes**, linked to identity, **not** for tracking, purpose
  **App Functionality**.
- [ ] Audio Data (Microphone): **Yes** (live only), linked, not tracking, App Functionality.
- [ ] Photos/Videos (Camera): **Yes** (live only), linked, not tracking, App Functionality.
- [ ] Photos/Videos (user-submitted Report attachment): **Yes** (optional), linked, App
  Functionality (Safety).
- [ ] User Content (chat messages): **Yes** (optional), linked, App Functionality.
- [ ] Diagnostics (Crash/Performance): optional, not linked, App Functionality (Analytics).
- [ ] Usage Data (Product Interaction): optional, not linked, Analytics — omit if no analytics
  SDK ships in this build.
- [ ] Contact Info, Location, Contacts, Financial Info, Health & Fitness, Browsing/Search
  History: **No, not collected** — leave unchecked.
- [ ] Do **not** select Third-Party Advertising / Developer's Advertising or Marketing /
  Personalization purposes anywhere.
- [ ] Publish the App Privacy details (separate "Publish" click from saving a draft in ASC).

## 6) App Review Information

- [ ] Sign-in required: **No** (no account/password).
- [ ] Contact info: a real name/phone/email the reviewer can reach if needed.
- [ ] Notes: paste from [`IOS_APP_STORE.md`](IOS_APP_STORE.md) §7 — the "ruletka is an 18+
  peer-to-peer video chat app…" block, including the demo steps and encryption line.
- [ ] Attachment (optional but recommended): a short demo screen recording of Start → match
  (or Friend Call) in case the reviewer's single device can't find a live match partner —
  not required by Apple but reduces first-pass rejection risk for random-match UGC video apps.

## 7) Screenshots

Per [`SCREENSHOTS.md`](../mobile/assets/store/ios/SCREENSHOTS.md):

- [ ] iPhone 6.7" (1290×2796) — 3 shots: idle Start, 1v1 live, Friends (Chats/Calls/Blocked).
- [ ] iPhone 6.5" (1284×2778) — same 3 shots.
- [ ] iPad shots only if `supportsTablet: true` stays on in `app.json` — otherwise mark iPad
  "not supported" for this listing so ASC doesn't block on missing iPad screenshots.
- [ ] No non-consenting testers' faces; no AI-generated faces (per `SCREENSHOTS.md`).
- [ ] Upload each size to its slot in **Prepare for Submission → App Previews and Screenshots**.

## 8) Export Compliance

- [ ] When ASC prompts (either here or at Submit time): "Does your app use encryption?" →
  answer per `IOS_APP_STORE.md` §6 — standard HTTPS/WSS + WebRTC DTLS-SRTP only, select the
  exemption for standard/exempt use. `ITSAppUsesNonExemptEncryption` should already read
  `false`/absent from `app.json` (verify only — do not edit `app.json` here).

## 9) Submit for Review

- [ ] Re-check every section above shows no red "incomplete" flags on the version page.
- [ ] Click **Add for Review**, confirm the export-compliance and content-rights prompts, then
  **Submit to App Review**.
- [ ] This step is **human-only** — no agent submits or claims Apple review PASS/REJECT.
