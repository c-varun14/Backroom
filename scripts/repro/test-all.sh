#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
command -v bun >/dev/null || { echo 'Install Bun 1.3.14 before running this suite.' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3 (standard library only) is required.' >&2; exit 1; }
started=$SECONDS
work="$(mktemp -d "${TMPDIR:-/tmp}/backroom-no-account.XXXXXXXX")"
cleanup() {
  result=$?
  trap - EXIT
  rm -rf -- "$work"
  printf 'No-account suite exit=%s in %ss; no install, login, Docker, Discord or Switch server used.\n' "$result" "$((SECONDS-started))"
  exit "$result"
}
trap cleanup EXIT
mkdir -p "$work/home" "$work/tmp" "$work/cache"
python3 "$ROOT/scripts/repro/stage-tests.py" "$ROOT" "$work/repo"
cd "$work/repo"
for input in rehearsal/bakery/app.test.ts rehearsal/bakery/demo.test.ts sample-projects/old-shop/server.test.js; do
  [[ -f "$input" ]] || { echo "Missing nested source: $input; include its working-tree files in the public repo." >&2; exit 1; }
done
# No inherited logins, dotenv, live service config or opt-in Docker tests.
run_clean() { env -i PATH="$PATH" HOME="$work/home" TMPDIR="$work/tmp" XDG_CACHE_HOME="$work/cache" LANG=C.UTF-8 BACKROOM_DOCKER_TEST=0 "$@"; }
run_clean python3 scripts/repro/test-copy.py
run_clean bun --no-env-file scripts/repro/validate-template.ts
run_clean bun --no-env-file test --dots desk/tests receipt/build.test.ts tests/adversarial deploy/local-compose.test.ts deploy/runtime-contract.test.ts rehearsal/bakery sample-projects/old-shop scripts/repro/repro.test.ts
