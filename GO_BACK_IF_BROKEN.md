# If overnight automation broke things

```bash
cd ~/freenet-roulette
./scripts/admin-agent/restore-pre-sleep.sh
```

Or tell Grok: **go back to before I went to sleep**

That restores git to snapshot:
- ID: see `backups/LATEST_PRE_SLEEP/meta.env`
- Branch: `backup/LATEST-pre-sleep-wip`

**Plan:** `docs/OVERNIGHT_9H_PLAY_PLAN.md`
