#!/usr/bin/env bash
# Start or restart every forum project's desk and the door. Never prints credentials.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
mkdir -p .switch-runtime/logs
shopt -s nullglob
for config in "$PWD"/.switch-runtime/projects/*.json; do
  slug="$(basename "$config" .json)"
  pkill -f "^bun --no-env-file desk/src/main.ts $config\$" || true
  sleep 1
  nohup setsid bash scripts/run-desk.sh "$config" >> ".switch-runtime/logs/$slug.log" 2>&1 < /dev/null &
  echo "desk: $slug launched"
done
bash scripts/run-door.sh
