#!/usr/bin/env bash
# CONNECTIVITY_LOCK regression suite — run before hub / MediaSession / ICE PRs.
# Exit non-zero if policy tests fail.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> cargo test connectivity_lock (pair_force_relay policy)"
if command -v cargo >/dev/null 2>&1; then
  # shellcheck disable=SC1090
  source "$HOME/.cargo/env" 2>/dev/null || true
  cargo test -p freenet-roulette-bridge connectivity_lock -- --nocapture
else
  echo "WARN: cargo not found — skip Rust tests"
fi

echo "==> mobile auto-retry schedule lock"
node mobile/src/media/connectUi.test.mjs

echo "==> mobile prefs / live unit tests (includes blurMode)"
if [[ -f mobile/scripts/test-live-units.mjs ]]; then
  # extend discovery: also run src/media/*.test.mjs
  node -e '
    import { readdirSync } from "node:fs";
    import { join, dirname } from "node:path";
    import { fileURLToPath } from "node:url";
    import { spawnSync } from "node:child_process";
    const root = join("'"$ROOT"'", "mobile");
    const dirs = ["src/live", "src/prefs", "src/media"].map((d) => join(root, d));
    let fail = 0, ran = 0;
    for (const dir of dirs) {
      let files = [];
      try { files = readdirSync(dir).filter((f) => f.endsWith(".test.mjs")); } catch { continue; }
      for (const f of files.sort()) {
        ran++;
        const r = spawnSync(process.execPath, [join(dir, f)], { encoding: "utf8" });
        if (r.status === 0) console.log("✓", f);
        else { fail++; console.error("✗", f); process.stderr.write(r.stdout || ""); process.stderr.write(r.stderr || ""); }
      }
    }
    if (!ran) { console.error("no tests"); process.exit(1); }
    if (fail) process.exit(1);
    console.log("live-units+media OK (" + ran + ")");
  '
fi

echo ""
echo "connectivity-lock OK"
echo "Human gate still required for connect PRs:"
echo "  install mobile/artifacts/ruletka-android-latest.apk (≥0.1.280)"
echo "  hard-refresh live.html · match once · PC must see phone face"
echo "  hub: force_relay=false for normal pair · no answerer offer drop"
