# Google Play Internal testing — upload AAB

Package: **`me.ruletka.app`**

## Ready binaries

| Version code | Source |
|--------------|--------|
| **4** | [Expo artifact](https://expo.dev/artifacts/eas/1Zg9q_UtLbeKCEmXeyY4rVKZMStgPOne51jZS36NQKE.aab) · local `mobile/artifacts/ruletka-0.1.0-vc4.aab` |
| **5** | [EAS build](https://expo.dev/accounts/courtiers-team/projects/ruletka/builds/9d626558-8b8c-465b-b7e1-4b2f05e0d101) (when FINISHED) |

Prefer **vc5** when ready (includes later layout + Start-card cleanups).

## Manual upload (no API key)

1. [Play Console](https://play.google.com/console) → app **me.ruletka.app**
2. **Testing → Internal testing → Create new release**
3. Upload the `.aab`
4. Release notes (draft):

```
Initial internal build: stranger match, friends, stars, safety tools.
18+ only.
```

5. Review → **Start rollout to Internal testing**
6. Add testers (email list or Google Group)
7. Share the opt-in link from Play Console

## Auto-submit (optional)

Save Play service account JSON as:

```text
mobile/secrets/google-play.json
```

Then:

```bash
cd mobile
npx eas-cli submit --profile production --platform android --latest
```

See `mobile/secrets/README.md`.

## After upload

- Device smoke: [`DEVICE_SMOKE.md`](DEVICE_SMOKE.md)
- Support / privacy URLs already on listing draft: `mobile/assets/store/LISTING.md`
