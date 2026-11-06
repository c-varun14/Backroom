#!/usr/bin/env bash
# Start the door once, in the background, logging to .switch-runtime/logs. Never prints credentials.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
mkdir -p .switch-runtime/logs
pkill -f '^bun --no-env-file desk/src/door' || true
sleep 1
nohup setsid bun --no-env-file desk/src/door.ts >> .switch-runtime/logs/door.log 2>&1 < /dev/null &
echo 'door: launched'
