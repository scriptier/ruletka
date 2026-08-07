# Mobile APK build (local, automated)

## Automation layers (all on)

| Layer | What | Version bump? |
|-------|------|----------------|
| **Grok standing rule** (`AGENTS.md`) | After mobile work, run build without waiting | **`--bump`** (new sideload version) |
| **Git post-commit hook** | Commit touches `mobile/app|src|assets|…` → background rebuild | **No** (same version, refresh binary; avoids dirty loop) |
| **Manual** | You or agent say “build apk” | optional `--bump` |

### Install post-commit hook (once per clone)

```bash
cd ~/freenet-roulette
./scripts/git-hooks/install-apk-hook.sh
```

- Log: `mobile/artifacts/apk-hook.log`  
- Skip one commit: `SKIP_APK_HOOK=1 git commit …`  
- Disable: `rm .git/hooks/post-commit`  

Hook uses a lockfile so builds don’t stack. Stale locks &gt;45m are ignored.

## Standing rule (Grok)

After **any meaningful `mobile/` change**:

```bash
cd /home/drakosik/freenet-roulette/mobile
./scripts/build-apk-local.sh --bump
```

Report the artifact path. **Do not wait** for “build apk”.

### Never auto
- Play Console upload  
- Bulk APK to public site download tree  
- `push.sh` unless human authorized deploy  

## Commands

| Command | Effect |
|---------|--------|
| `./scripts/build-apk-local.sh` | Build current `app.json` version |
| `./scripts/build-apk-local.sh --bump` | Patch version + versionCode, then build |
| `npm run build:apk` / `npm run build:apk:bump` | Same from `mobile/` |
| `./scripts/build-aab-local.sh` | Play AAB (upload separately) |
| `./scripts/git-hooks/install-apk-hook.sh` | Enable post-commit APK rebuild |

## Output

- `mobile/artifacts/ruletka-<ver>-vc<code>.apk`
- `mobile/artifacts/ruletka-latest.apk`
- `mobile/artifacts/ruletka-android-latest.apk` → latest named APK  

## Human phrases

- **build apk** → run script (prefer `--bump` after feature work)  
- **proceed to automate** → hook + AGENTS standing rule (this doc)
