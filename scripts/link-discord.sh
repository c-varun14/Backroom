#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec .switch-runtime/venv/bin/python scripts/link_discord.py
