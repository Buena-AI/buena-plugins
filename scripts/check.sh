#!/usr/bin/env bash
set -euo pipefail
exec bun "$(dirname "$0")/check.ts" "${1:-all}"
