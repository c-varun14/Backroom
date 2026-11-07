#!/usr/bin/env bash
# Restart the server's supervised door/desks. Never launch a laptop gateway.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ "$PWD" == /srv/backroom && $(id -u) == 0 ]]; then
  exec systemctl restart backroom-studio
fi
# Owner root connection only. Studio cannot restart root services via its broker.
exec ssh -o BatchMode=yes backroom-dev 'systemctl restart backroom-studio'
