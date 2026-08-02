#!/bin/bash
# ruletka network helper — double-click in Finder (macOS)
# First run: right-click → Open if Gatekeeper blocks unsigned downloads.
cd "$(dirname "$0")" || exit 1
clear
echo ""
echo "  ruletka · network helper (macOS)"
echo "  ────────────────────────────────"
echo "  Double-click launcher. First run may download components."
echo ""

# Ensure executable bits (zip/download often strips them)
chmod +x "./rulet-helper-mac.sh" 2>/dev/null || true
chmod +x "./rulet-helper-mac.command" 2>/dev/null || true

if [[ ! -f "./rulet-helper-mac.sh" ]]; then
  echo "Missing rulet-helper-mac.sh next to this file."
  echo "Download both from https://ruletka.vip/contribute.html"
  read -r -p "Press Enter to close…"
  exit 1
fi

export RULETKA_NO_BROWSER="${RULETKA_NO_BROWSER:-0}"
exec bash "./rulet-helper-mac.sh"
