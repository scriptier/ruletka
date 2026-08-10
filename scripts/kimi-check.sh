#!/usr/bin/env bash
export PATH="$HOME/.kimi-code/bin:$PATH"
echo "kimi: $(command -v kimi)"
kimi doctor
echo "---"
kimi -p "Reply exactly: KIMI_OK" --output-format text
