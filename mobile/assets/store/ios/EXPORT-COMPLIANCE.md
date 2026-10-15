# App Store Connect / TestFlight — Export Compliance

Paste in **TestFlight → Export Compliance** (asked on every new build upload).

## Answer

| Question | Answer |
|----------|--------|
| Does your app use encryption? | **No** *(select "None of the algorithms mentioned above")* |
| Is your app designed to use cryptography or does it contain or incorporate cryptography? | **No** |

`app.config.js` already declares this so the prompt should be skipped on upload:

```
ITSAppUsesNonExemptEncryption: false
```

## Why "No" is correct

The app only uses:
- **HTTPS/TLS** for hub + API calls (standard, exempt under Apple's export rules — category 5 part 2 exemption for encryption solely for the purpose of authenticating/securing app data over standard protocols).
- **WebRTC DTLS/SRTP** for peer video/audio (standard OS/browser-provided encryption, also exempt).

No custom or proprietary cryptography is implemented or bundled. This qualifies for the **exempt** classification, so `ITSAppUsesNonExemptEncryption` stays `false` and no annual self-classification report (ERN/CCATS) is required.

If this ever changes (e.g. custom E2E encryption added beyond DTLS/SRTP), re-answer **Yes** and revisit export classification before uploading.
