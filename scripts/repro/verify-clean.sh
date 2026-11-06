#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/backroom-clean-verify.XXXXXXXX")"
trap 'rm -rf -- "$work"' EXIT
python3 "$ROOT/scripts/repro/clean-copy.py" --output "$work/source" "$@"
# The copy has no source checkout, credentials, caches or Git metadata.
(cd "$work/source" && bash scripts/repro/test-all.sh)
printf 'Clean-copy verification complete; temporary copy removed on exit.\n'
