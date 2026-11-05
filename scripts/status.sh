#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec .switch-runtime/venv/bin/python scripts/block1_runtime.py status
