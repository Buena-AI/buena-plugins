#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
"$root/scripts/check.sh" openai
version="$(grep -m1 '"version"' "$root/openai/buena-ai/plugin.json" | sed -E 's/.*"version": *"([^"]+)".*/\1/')"
mkdir -p "$root/dist"
out="$root/dist/buena-ai-openai-$version.zip"
rm -f "$out"
(cd "$root/openai/buena-ai" && zip -r -X -q "$out" plugin.json mcp.json skills assets -x '*.DS_Store')
unzip -l "$out"
