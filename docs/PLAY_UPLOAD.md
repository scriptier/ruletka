# Google Play Internal testing — upload AAB

Package: **`me.ruletka.app`**

## Ready binaries

| Version code | Source |
|--------------|--------|
| **6** (prefer) | [EAS build](https://expo.dev/accounts/courtiers-team/projects/ruletka/builds/d6de984a-72d7-48ee-a59f-24e2da3b8785) · [AAB download](https://expo.dev/artifacts/eas/GfChIFs_P8ZgFKav1jqyZ9mnBWlOUJg1ixepxDo6IN8.aab) · local `mobile/artifacts/ruletka-0.1.0-vc6.aab` |
| **5** | [EAS](https://expo.dev/accounts/courtiers-team/projects/ruletka/builds/9d626558-8b8c-465b-b7e1-4b2f05e0d101) · `mobile/artifacts/ruletka-0.1.0-vc5.aab` |
| **4** | [Expo artifact](https://expo.dev/artifacts/eas/1Zg9q_UtLbeKCEmXeyY4rVKZMStgPOne51jZS36NQKE.aab) · `mobile/artifacts/ruletka-0.1.0-vc4.aab` |

Prefer **vc6** (commit `896e6be` — latest `main`, hub `https://ruletka.vip`).

## Manual upload (no API key)

1. [Play Console](https://play.google.com/console) → app **me.ruletka.app**
2. **Testing → Internal testing → Create new release**
3. Upload `mobile/artifacts/ruletka-0.1.0-vc6.aab` (or the EAS AAB link above)
4. Release notes (draft):

```
Internal build vc6: stranger match, friends, stars/reputation, safety tools.
Hub: ruletka.vip · 18+ only.
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
npx eas-cli submit --profile production --platform android --id d6de984a-72d7-48ee-a59f-24e2da3b8785
# or:
npx eas-cli submit --profile production --platform android --latest
```

See `mobile/secrets/README.md`.

## After upload

- Device smoke: [`DEVICE_SMOKE.md`](DEVICE_SMOKE.md)
- Support / privacy URLs already on listing draft: `mobile/assets/store/LISTING.md`
