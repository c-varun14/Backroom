#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
unset COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_PROFILES
export DEMO_UID="$(id -u)" DEMO_GID="$(id -g)"
state=.secrets/judge-demo
compose() { docker compose --project-name backroom-judge-demo --env-file "$state/stack.env" -f compose.yaml "$@"; }
if [[ "${1:-}" == --down ]]; then
  if [[ -f "$state/stack.env" ]]; then compose down --volumes --remove-orphans; fi
  echo 'Removed backroom-judge-demo containers, network and volumes only.'
  exit 0
fi
[[ $# == 0 ]] || { echo 'Usage: bash demo.sh [--down]' >&2; exit 2; }
command -v docker >/dev/null || { echo 'Docker with Compose is required.' >&2; exit 1; }
docker compose version >/dev/null
started=$SECONDS
mkdir -p "$state" demo/out
chmod 700 "$state"
rm -f demo/out/receipt.json demo/out/receipt.html demo/out/build-*-checks.txt demo/out/review-*-checks.txt
# Repeated runs start fresh, never mix regenerated credentials with an old volume.
if [[ -f "$state/stack.env" ]]; then compose down --volumes --remove-orphans >/dev/null; fi
anonymous="$(mktemp -d)"
trap 'rm -rf -- "$anonymous"' EXIT
export DOCKER_CONFIG="$anonymous"
echo 'Checking anonymous pulls with an empty Docker configuration...'
for image in ghcr.io/sandbox-quantum/switch-core:0.31.0 ghcr.io/sandbox-quantum/gateway:0.31.0 postgres:16-alpine oven/bun:1.3.14; do
  docker --config "$anonymous" pull "$image"
done
docker run --rm -e DEMO_UID -e DEMO_GID -v "$PWD:/repo:ro" -v "$PWD/$state:/state" oven/bun:1.3.14 bun --no-env-file /repo/demo/init.ts
compose build runner
compose up -d postgres init-db switch gateway runner
status=1
for ((i=0;i<240;i++)); do
  if compose exec -T runner test -f /state/story.done 2>/dev/null; then status=0; break; fi
  rg_runner="$(compose ps --status running --services)"
  if [[ "$rg_runner" != *runner* ]]; then break; fi
  sleep 1
done
if [[ $status == 0 ]]; then
  echo 'Stopping Switch for five real dependency attempts...'
  compose stop switch >/dev/null
  compose exec -T runner bun --no-env-file demo/control.ts off || status=$?
  compose up -d --no-deps switch >/dev/null
  compose exec -T runner bun --no-env-file demo/control.ts recover || status=$?
fi
compose logs --no-log-prefix runner
if [[ $status == 0 ]]; then
  compose exec -T runner bun --no-env-file demo/control.ts summary || status=$?
fi
printf 'Demo wall time: %ss (including pulls/build/startup).\n' "$((SECONDS-started))"
echo 'Receipt: demo/out/receipt.html · Bakery: http://127.0.0.1:49163'
echo 'Cleanup: bash demo.sh --down'
exit "$status"
