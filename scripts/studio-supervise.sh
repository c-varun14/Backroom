#!/usr/bin/env bash
# One supervisor per checkout; child output is routed to the systemd journal.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
export BACKROOM_SUPERVISED=1
exec python3 scripts/studio_supervise.py
