#!/usr/bin/env bash
export PATH="$HOME/.local/bin:$HOME/.config/Claude/claude-code/2.1.222:$PATH"
echo "claude: $(command -v claude)"
claude --version
echo "---"
cd /home/drakosik/freenet-roulette || exit 1
claude -p "Reply exactly: CLAUDE_OK" --output-format text
