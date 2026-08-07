# AGENTS.md — Grok Build (ruletka)

## Standing: local APK automation

After **any meaningful change under `mobile/`** (Live UI, MediaSession, hub client, prefs, shipped i18n):

```bash
cd /home/drakosik/freenet-roulette/mobile
./scripts/build-apk-local.sh --bump
```

Report the artifact path. **Do not wait** for the human to say “build apk”.

Full detail: `docs/MOBILE_BUILD.md`.

### Also available
- **Git post-commit hook** (optional install): rebuilds APK **without** version bump when a commit touches `mobile/` source — see `scripts/git-hooks/post-commit-apk`.
- **Phrase:** “build apk” → run script; “bump apk” → `--bump`.

### Never auto
- Production deploy / `push.sh` unless human authorized  
- Play Console upload  
- Bulk APK on public website  

## Connect
Do not regress `docs/CONNECTIVITY_LOCK.md`. P2P only; no SFU default.
