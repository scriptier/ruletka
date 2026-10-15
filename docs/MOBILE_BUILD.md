# Mobile APK build (local, on request)

**Project stance: augmentation, not automation.**  
Agents do **not** rebuild APK after every `mobile/` edit. Human (or explicit phrase) triggers builds.

## Layers

| Layer | What | When |
|-------|------|------|
| **Human / phrase** | `./scripts/build-apk-local.sh` | “build apk”, “bump apk”, “sideload build” |
| **Git post-commit hook** | Optional, human-installed | Only if you installed the hook |
| **Grok** | May run build script | **Only** when asked or after you accept a scorecard-backed plan that requires mobile |

### Install post-commit hook (optional, once per clone)

```bash
cd ~/freenet-roulette
./scripts/git-hooks/install-apk-hook.sh
```

- Log: `mobile/artifacts/apk-hook.log`  
- Skip one commit: `SKIP_APK_HOOK=1 git commit …`  
- Disable: `rm .git/hooks/post-commit`  

Hook uses a lockfile so builds don’t stack. Stale locks &gt;45m are ignored.

## Commands

```bash
cd /home/drakosik/freenet-roulette/mobile
./scripts/build-apk-local.sh           # same versionCode refresh
./scripts/build-apk-local.sh --bump    # patch version + versionCode
```

Report the artifact path under `mobile/artifacts/`.

## Local emulator (optional)

SDK: `$HOME/Android/Sdk`. Launch:

```bash
./scripts/emu-ruletka.sh            # ruletka_api34 (API 34, host webcam = front)
./scripts/emu-ruletka.sh --play     # ruletka_api34_play (Play Store image)
./scripts/emu-ruletka.sh --kill
```

Useful for crash / Friends / Settings / deeplink. **Not** a Pixel stand-in for product.ok, SoftBlur, or same-WiFi A/V. KVM already works via ACL; optional permanence: `sudo usermod -aG kvm,video $USER` then re-login.

`build-apk-local.sh` auto-pushes the APK to phone `Download/` when a device is on adb (prefers Pixel 9 Pro; use `--no-push` to skip).  
Re-push without rebuild: `./scripts/push-apk-to-phone.sh` (optional path; `--install` also runs `adb install -r`).  
Detail paths: `mobile/artifacts/ruletka-0*.apk` → `/sdcard/Download/<basename>` and `ruletka-latest.apk`.

### Never auto (agents)

- Play Console upload  
- **Website APK** — do not copy/rsync `*.apk` to `ui/download/` or prod `/opt/ruletka/ui/download/` after a local bump. Human says **put apk on the site** / **update website apk** when they want `/download/android.html` refreshed. Sideload for smoke is `adb` / phone `Download/` only.  
- `push.sh` unless human authorized deploy  
- Unprompted `--bump` after every MediaSession tweak  

### Connect / A/V

Before building for black-cam work: run `./scripts/av-verify.sh` and prefer a non-worse scorecard. See `AGENTS.md` and skill `av-fix-loop`.
