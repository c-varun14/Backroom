#!/usr/bin/env bash
# Owner step: sends the named cleanup to the dev server. Prints names and status codes only.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
ssh -o BatchMode=yes backroom-dev 'cd /srv/backroom && runuser -u studio -- python3 -' < scripts/clear-test-projects.py
