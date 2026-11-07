#!/usr/bin/env bash
# Compose is started with --wait by systemd. Exit on an unhealthy API/container
# so Restart=always re-runs Compose and restores failed containers.
set -euo pipefail
cd /etc/backroom
compose=(docker compose -p backroom-block0 --env-file /etc/backroom/switch.env -f /etc/backroom/switch-compose.yml --profile gateway)
while true; do
  curl -fsS --max-time 5 http://127.0.0.1:8000/health >/dev/null 2>&1
  for service in postgres switch gateway; do
    id=$("${compose[@]}" ps -q "$service")
    [[ -n "$id" ]]
    [[ $(docker inspect --format '{{.State.Running}}' "$id") == true ]]
  done
  sleep 5
done
