#!/usr/bin/env bash
# Laptop entry point. Native command output is withheld by the Python driver.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
exec python3 scripts/studio_move.py "$@"
