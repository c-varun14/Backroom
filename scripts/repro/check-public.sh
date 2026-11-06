#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/backroom-public-audit.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
python3 "$ROOT/scripts/repro/clean-copy.py" --public --output "$work/source"
python3 "$ROOT/scripts/repro/check-public-copy.py" "$work/source"
(cd "$work/source" && bash scripts/repro/test-all.sh)
