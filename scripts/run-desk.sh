#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ $# -gt 1 ]]; then echo 'Usage: bash scripts/run-desk.sh [client-config.json]' >&2; exit 2; fi
if [[ $# == 1 ]]; then export BACKROOM_CLIENT_CONFIG="$1"; fi
exec bun --no-env-file desk/src/main.ts
