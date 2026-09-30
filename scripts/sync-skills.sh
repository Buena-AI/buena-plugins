#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
for pkg in claude/buena-ai openai/buena-ai; do
  mkdir -p "$root/$pkg"
  rm -rf "$root/$pkg/skills"
  cp -R "$root/skills" "$root/$pkg/skills"
done
echo "synced skills into claude/buena-ai and openai/buena-ai"
