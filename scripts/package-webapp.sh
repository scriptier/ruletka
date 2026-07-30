#!/usr/bin/env bash
# Stage a Freenet website directory (must include index.html).
# Uses live UI as the main entry; dual-pane sim at sim.html.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/target/webapp}"
UI="$ROOT/ui"

rm -rf "$DEST"
mkdir -p "$DEST"

# Static assets from ui/
cp -a "$UI/." "$DEST/"

# Freenet website entrypoint must be index.html — ship the live roulette UI.
cp -f "$DEST/live.html" "$DEST/index.html"

# Dual-pane monoid demo (previous index)
if [[ -f "$UI/index.html" ]]; then
  # live.html already copied; restore sim from original if we overwrote
  # We overwrote index with live — write sim from a copy we still have in DEST
  # Original dual-pane was copied as index first then overwritten; re-fetch sim:
  :
fi
# Keep dual-pane under sim.html if the copy still has the old dual-pane content
# live.html was the live app; original index was dual-pane — re-copy dual-pane from git-ish path:
if [[ -f "$UI/app.js" ]]; then
  # Rebuild sim.html from the dual-pane index we had before overwrite
  # package: we saved live to index; write dual-pane from known path
  true
fi

# Prefer dual-pane at sim.html: read from ui before any overwrite
# (ui/index.html is still the dual-pane file on disk)
cp -f "$UI/index.html" "$DEST/sim.html"

# Discovery metadata for humans / Atlas crawlers
cp -f "$ROOT/webapp/freenet-app.json" "$DEST/freenet-app.json"
cat > "$DEST/robots.txt" <<'EOF'
# Freenet web container — allow discovery crawlers
User-agent: *
Allow: /
EOF

# Small about page for crawlers / Atlas
cat > "$DEST/about.html" <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Freenet Chat Roulette — About</title>
  <meta name="description" content="Decentralized stranger video chat on Freenet: lobby monoid matchmaking, session contracts, WebRTC P2P media, friends and party browse." />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header>
    <h1>Freenet Chat Roulette</h1>
    <p class="tagline">Stranger video chat · monoid lobby · P2P WebRTC</p>
  </header>
  <main style="max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.55">
    <p>
      Decentralized Chat Roulette for Freenet. Peers match via a lobby monoid
      (mutual claims), open a session contract for chat and WebRTC signaling,
      and stream camera/mic peer-to-peer.
    </p>
    <ul>
      <li><a href="/">Live UI</a> — multi-tab / bridge demo path</li>
      <li><a href="/sim.html">Local sim</a> — dual-pane monoid demo</li>
      <li><a href="/freenet-app.json">freenet-app.json</a> — machine-readable descriptor</li>
    </ul>
    <p>Tags: chat, video, webrtc, roulette, freenet, social, friends, p2p</p>
  </main>
</body>
</html>
EOF

echo "Staged webapp → $DEST"
ls -la "$DEST" | head -30
test -f "$DEST/index.html"
test -f "$DEST/freenet-app.json"
echo "OK package-webapp"
