#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
printf '%s\n' 'stage1-sample' > .switch-runtime/simulate.request
printf '%s\n' 'Requested a labeled SAMPLE handoff. This sends nothing to the client and records no human approvals.'
