#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ $# -gt 1 ]]; then echo 'Usage: bash scripts/run-desk.sh [client-config.json]' >&2; exit 2; fi
if [[ $# == 1 ]]; then export BACKROOM_CLIENT_CONFIG="$1"; fi
# The shared per-config lock also covers new_project.py's standalone launcher.
config="${1:-${BACKROOM_CLIENT_CONFIG:-.switch-runtime/block1.json}}"
config=$(realpath -m -- "$config")
lock_id=$(printf '%s' "$config" | sha256sum | cut -d ' ' -f 1)
mkdir -p .switch-runtime/desk-locks
exec 9>".switch-runtime/desk-locks/$lock_id.lock"
flock -n 9 || exit 0
exec bun --no-env-file desk/src/main.ts "$@"
