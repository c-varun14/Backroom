#!/usr/bin/env bash
# Start the door once. The supervisor uses foreground mode for crash detection.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
mkdir -p .switch-runtime/logs
case "${1:-}" in
  --foreground)
    [[ $# == 1 ]]
    exec 9>.switch-runtime/door.lock
    flock -n 9 || exit 0
    exec bun --no-env-file desk/src/door.ts
    ;;
  '')
    [[ $# == 0 ]]
    nohup setsid bash scripts/run-door.sh --foreground >> .switch-runtime/logs/door.log 2>&1 < /dev/null &
    echo 'door: start requested'
    ;;
  *) echo 'Usage: run-door.sh [--foreground]' >&2; exit 2 ;;
esac
