#!/usr/bin/env bash
# Disposable Better-T-Stack review services. stdout is exactly one JSON line.
set -Eeuo pipefail
umask 077
# Keep setup diagnostics visible even when a failing command redirects its logs.
exec 8>&2
[[ $# -ge 1 && $# -le 2 ]] || { echo 'Usage: review-env.sh <workspace> [up|down|status]' >&2; exit 2; }
workspace=$(cd -- "$1" && pwd -P)
action=${2:-up}
case "$action" in up|down|status) ;; *) echo 'Expected up, down or status' >&2; exit 2 ;; esac
script=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)/review-env.sh
command -v python3 >/dev/null || { echo 'python3 is required' >&2; exit 1; }
state_root=/tmp/backroom-review-$(id -u)
if ! mkdir -m 700 -- "$state_root" 2>/dev/null; then
  [[ -d "$state_root" && ! -L "$state_root" && -O "$state_root" && $(stat -c %a "$state_root") == 700 ]] || { echo 'Unsafe review state directory' >&2; exit 1; }
fi
key=$(python3 - "$workspace" <<'PY'
import hashlib, sys
print(hashlib.sha256(sys.argv[1].encode()).hexdigest())
PY
)
# Serialize lifecycle operations without touching the source workspace.
exec 9>"$state_root/$key.lock"
flock -x 9
pointer=$state_root/$key.path
runtime=''
if [[ -f "$pointer" && ! -L "$pointer" ]]; then
  IFS= read -r runtime < "$pointer"
  [[ "$runtime" == "$state_root/$key."* && -d "$runtime" && ! -L "$runtime" && -O "$runtime" ]] || { echo 'Invalid review runtime directory' >&2; exit 1; }
fi
stop_services() {
  [[ -n "$runtime" ]] || return 0
  if [[ -f "$runtime/services.py" ]]; then python3 "$runtime/services.py" stop; fi
  if [[ -f "$runtime/container" ]]; then
    if docker container inspect --format '{{.Id}}' "$(cat "$runtime/container")" >/dev/null 2>&1; then
      docker rm -f --volumes "$(cat "$runtime/container")" >"$runtime/docker-down.log" 2>&1 || return 1
    else
      # An unreachable daemon is not proof that our container was removed.
      docker version --format '{{.Server.Version}}' >"$runtime/docker-down.log" 2>&1 || return 1
    fi
  elif [[ -f "$runtime/pg/PG_VERSION" ]]; then
    command -v pg_ctl >/dev/null || return 1
    if pg_ctl -D "$runtime/pg" status >/dev/null 2>&1; then
      pg_ctl -D "$runtime/pg" -m immediate -w stop >"$runtime/pg-down.log" 2>&1 || return 1
    fi
  fi
}
health() {
  if [[ -f "$runtime/container" ]]; then
    docker exec "$(cat "$runtime/container")" pg_isready -U review -d review >/dev/null 2>&1 || return 1
  elif [[ -f "$runtime/pg/PG_VERSION" ]]; then
    pg_ctl -D "$runtime/pg" status >/dev/null 2>&1 || return 1
  else return 1; fi
  python3 - "$runtime" <<'PY'
import json, pathlib, sys, urllib.request
root = pathlib.Path(sys.argv[1])
try:
    data = json.loads((root / 'result.json').read_text())
    for url in [data['api_url'] + '/health', data['web_url']]:
        with urllib.request.urlopen(url, timeout=2) as r:
            if r.status != 200: raise ValueError()
except Exception: sys.exit(1)
PY
}
if [[ "$action" == down ]]; then
  stop_services
  [[ -z "$runtime" ]] || rm -rf -- "$runtime"
  rm -f -- "$pointer"
  printf '%s\n' '{"status":"down"}'
  exit 0
fi
if [[ "$action" == status ]]; then
  if [[ -n "$runtime" ]] && health; then cat "$runtime/result.json"; else printf '%s\n' '{"status":"down"}'; fi
  exit 0
fi
if [[ -n "$runtime" ]] && health; then cat "$runtime/result.json"; exit 0; fi
if [[ -n "$runtime" ]]; then stop_services; rm -rf -- "$runtime"; rm -f -- "$pointer"; runtime=''; fi
for cmd in git pnpm node; do command -v "$cmd" >/dev/null || { echo "$cmd is required" >&2; exit 1; }; done
runtime=$(mktemp -d "$state_root/$key.XXXXXXXX")
printf '%s\n' "$runtime" > "$pointer"
failed() {
  echo "Review environment setup blocked; private diagnostics: $runtime (no log contents printed). Run down before retrying." >&8
  stop_services || true
}
trap failed ERR
# Export the exact committed candidate, never dependencies, .env or untracked
# files from the source checkout. Installs and framework codegen run in this copy.
mkdir "$runtime/source"
python3 - "$workspace" "$runtime/source" <<'PYEXPORT'
import pathlib, subprocess, sys
workspace, target = sys.argv[1], pathlib.Path(sys.argv[2])
# Export only committed regular files. Never open .secrets or .env blobs, and
# never copy symlinks that could send codegen writes outside the disposable copy.
entries = subprocess.check_output(['git', '-C', workspace, 'ls-tree', '-rz', 'HEAD']).split(b'\0')
with subprocess.Popen(['git', '-C', workspace, 'cat-file', '--batch'], stdin=subprocess.PIPE, stdout=subprocess.PIPE) as process:
    for entry in filter(None, entries):
        metadata, raw = entry.split(b'\t', 1)
        mode, kind, oid = metadata.split()
        relative = pathlib.PurePosixPath(raw.decode())
        if any(part in {'.secrets', '.git'} or (part.startswith('.env') and part != '.env.schema') for part in relative.parts): continue
        if kind != b'blob' or mode not in {b'100644', b'100755'}:
            raise SystemExit('Review source must contain regular files, no symlinks or submodules')
        if relative.is_absolute() or '..' in relative.parts: raise SystemExit('Unsafe source path')
        process.stdin.write(oid + b'\n'); process.stdin.flush()
        size = int(process.stdout.readline().split()[2])
        data = process.stdout.read(size)
        if len(data) != size or process.stdout.read(1) != b'\n': raise SystemExit('Incomplete git export')
        output = target / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(data); output.chmod(0o700 if mode == b'100755' else 0o600)
    process.stdin.close()
    if process.wait(): raise SystemExit('Git export failed')
PYEXPORT
source_root=$runtime/source
[[ -f "$source_root/apps/server/src/index.ts" && -f "$source_root/apps/web/vite.config.ts" && -f "$source_root/packages/db/package.json" ]]
# Configuration is generated, never sourced from the invoking shell or checkout.
python3 - "$runtime" <<'PY'
import json, pathlib, secrets, shlex, socket, sys
root = pathlib.Path(sys.argv[1])
sockets = []
for _ in range(3):
    sock = socket.socket(); sock.bind(('127.0.0.1', 0)); sockets.append(sock)
pg, api, web = [s.getsockname()[1] for s in sockets]
password = secrets.token_hex(24)
values = {
    'NODE_ENV': 'development', 'PORT': str(api),
    'DATABASE_URL': f'postgresql://review:{password}@127.0.0.1:{pg}/review',
    'BETTER_AUTH_SECRET': secrets.token_hex(32),
    'HUB_SECRET': secrets.token_hex(32), 'POLAR_WEBHOOK_SECRET': secrets.token_hex(32),
    'BETTER_AUTH_URL': f'http://localhost:{api}', 'CORS_ORIGIN': f'http://localhost:{web}',
    'PUBLIC_SERVER_URL': f'http://localhost:{api}', 'POLAR_ACCESS_TOKEN': '',
    'POLAR_SUCCESS_URL': f'http://localhost:{web}',
    'PGPASSWORD': password, 'PGPORT': str(pg), 'WEB_PORT': str(web),
    'npm_config_store_dir': str(root / 'store'), 'npm_config_cache': str(root / 'cache'),
}
(root / 'config.sh').write_text(''.join(f'export {k}={shlex.quote(v)}\n' for k, v in values.items()))
(root / 'pg-password').write_text(password + '\n')
(root / 'owner.json').write_text(json.dumps({'name': 'Fictional Review Owner', 'email': 'owner@review.example.test', 'password': secrets.token_hex(24)}))
(root / 'user.json').write_text(json.dumps({'name': 'Fictional Review User', 'email': 'user@review.example.test', 'password': secrets.token_hex(24)}))
# App-base currently fixes serve() at 3000 and Vite's same-origin proxy at
# localhost:3000. Change only this disposable copy's listener/proxy wiring.
entry = root / 'source/apps/server/src/index.ts'
text = entry.read_text()
import re
text, count = re.subn(r'port:\s*3000\b', 'port: Number(process.env.PORT), hostname: "127.0.0.1"', text)
if count != 1: raise SystemExit('Unsupported API listener; review environment needs a port adapter')
entry.write_text(text)
vite = root / 'source/apps/web/vite.config.ts'
vite.write_text(vite.read_text().replace('http://localhost:3000', values['BETTER_AUTH_URL'].replace('localhost', '127.0.0.1')))
PY
# Every child gets a deliberately small environment: no inherited provider keys.
cat > "$runtime/run" <<'RUN'
#!/usr/bin/env bash
set -euo pipefail
runtime=$(cd -- "$(dirname -- "$0")" && pwd -P)
source "$runtime/config.sh"
cd "$runtime/source"
exec "$@"
RUN
chmod 700 "$runtime/run"
run() { env -i PATH="$PATH" HOME="$HOME" "$runtime/run" "$@"; }
# Read only our generated configuration, not any workspace .env files.
source "$runtime/config.sh"
if [[ "${BACKROOM_REVIEW_BACKEND:-auto}" != local ]] && command -v docker >/dev/null; then
  container=backroom-review-${key:0:12}-$(basename "$runtime" | cut -d. -f2)
  printf '%s\n' "$container" > "$runtime/container"
  # An env file keeps the throwaway DB password out of argv and process listings.
  printf 'POSTGRES_USER=review\nPOSTGRES_DB=review\nPOSTGRES_PASSWORD=%s\n' "$PGPASSWORD" > "$runtime/postgres.env"
  docker run --rm --detach --name "$container" --label backroom.review=true --env-file "$runtime/postgres.env" -p "127.0.0.1:$PGPORT:5432" postgres:17 > "$runtime/docker-up.log" 2>&1
  for ((i=0; i<90; i++)); do
    if docker exec "$container" pg_isready -U review -d review > /dev/null 2>&1; then break; fi
    sleep 1
  done
  docker exec "$container" pg_isready -U review -d review > /dev/null 2>&1
else
  command -v initdb >/dev/null && command -v pg_ctl >/dev/null
  initdb -D "$runtime/pg" -U review --auth-host=scram-sha-256 --auth-local=trust --pwfile="$runtime/pg-password" > "$runtime/initdb.log" 2>&1
  pg_ctl -D "$runtime/pg" -l "$runtime/postgres.log" -o "-h 127.0.0.1 -p $PGPORT -k $state_root" -w start > "$runtime/pg-up.log" 2>&1
  # createdb is not required: use pg through the installed workspace dependency.
fi
run pnpm install --frozen-lockfile --store-dir "$runtime/store" > "$runtime/install.log" 2>&1
if [[ ! -f "$runtime/container" ]]; then
  run pnpm --dir packages/db exec node --input-type=module -e 'import pg from "pg"; const c=new pg.Client({connectionString:process.env.DATABASE_URL.replace(/\/review$/, "/postgres")}); await c.connect(); await c.query("CREATE DATABASE review"); await c.end();' > "$runtime/create-db.log" 2>&1
fi
run pnpm --dir packages/db db:migrate > "$runtime/migrate.log" 2>&1
# Persist exact service restart commands next to their generated configuration.
python3 - "$runtime" <<'PY'
import pathlib, shlex, sys
root = pathlib.Path(sys.argv[1])
for name, args in [('api', ['pnpm', '--dir', 'apps/server', 'exec', 'tsx', 'src/index.ts']),
                   ('web', ['pnpm', '--dir', 'apps/web', 'exec', 'vite', 'dev', '--host', '127.0.0.1', '--strictPort'])]:
    command = shlex.join([str(root / 'run')] + args)
    if name == 'web': command += ' --port "$WEB_PORT"'
    (root / f'{name}.sh').write_text('#!/usr/bin/env bash\nset -euo pipefail\nsource ' + shlex.quote(str(root / 'config.sh')) + '\nexec env -i PATH="$PATH" HOME="$HOME" ' + command + '\n')
    (root / f'{name}.sh').chmod(0o700)
PY
# Separate sessions let down stop pnpm and descendants. Restart uses the same
# generated environment and records fresh process identities for later teardown.
cat > "$runtime/services.py" <<'PYSERVICES'
import json, os, pathlib, signal, subprocess, sys, time
root = pathlib.Path(__file__).resolve().parent
action = sys.argv[1]
names = sys.argv[2:] or ['api', 'web']
for name in names:
    if name not in {'api', 'web'}: raise SystemExit('Unknown review service')
    file = root / f'{name}.process.json'
    if action in {'stop', 'restart'} and file.exists():
        info = json.loads(file.read_text())
        try:
            stat = pathlib.Path(f'/proc/{info["pid"]}/stat').read_text().rsplit(')', 1)[1].split()
            if stat[19] == info['birth']:
                os.killpg(info['pid'], signal.SIGTERM); time.sleep(.3)
                try: os.killpg(info['pid'], signal.SIGKILL)
                except ProcessLookupError: pass
        except (FileNotFoundError, ProcessLookupError): pass
        file.unlink()
    if action in {'start', 'restart'}:
        with (root / f'{name}.log').open('ab') as log:
            p = subprocess.Popen([str(root / f'{name}.sh')], env={'PATH': os.environ['PATH'], 'HOME': os.environ['HOME']}, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
        birth = pathlib.Path(f'/proc/{p.pid}/stat').read_text().rsplit(')', 1)[1].split()[19]
        file.write_text(json.dumps({'pid': p.pid, 'birth': birth}))
PYSERVICES
python3 "$runtime/services.py" start
python3 - "$runtime" "$workspace" "$script" <<'PY'
import json, os, pathlib, sys, time, urllib.error, urllib.request
root = pathlib.Path(sys.argv[1])
api, web = os.environ['BETTER_AUTH_URL'], os.environ['CORS_ORIGIN']
for url in [api + '/health', web]:
    for _ in range(120):
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200: break
        except (OSError, urllib.error.URLError): pass
        time.sleep(1)
    else: raise SystemExit('Services did not become healthy; see private runtime logs')
for role in ['owner', 'user']:
    payload = (root / f'{role}.json').read_bytes()
    request = urllib.request.Request(api + '/api/auth/sign-up/email', data=payload, headers={'Content-Type': 'application/json', 'Origin': web})
    # Do not print auth responses, cookies or passwords in diagnostics.
    try:
        with urllib.request.urlopen(request, timeout=30) as r:
            response = json.load(r)
            if not response.get('user', {}).get('id'): raise ValueError()
    except Exception: raise SystemExit(f'Fictional {role} signup failed; check private service logs')
PY
run pnpm --dir packages/db exec node --input-type=module -e 'import pg from "pg"; const c=new pg.Client({connectionString:process.env.DATABASE_URL}); await c.connect(); const r=await c.query(`UPDATE "user" SET role=$1 WHERE email=$2 RETURNING id`,["owner","owner@review.example.test"]); if(r.rowCount!==1) throw new Error("Owner promotion failed"); await c.end();' > "$runtime/promote.log" 2>&1
python3 - "$runtime" "$workspace" "$script" <<'PY'
import json, os, pathlib, shlex, sys
root, workspace, script = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
result = {'status': 'up', 'workspace': workspace, 'runtime_dir': str(root),
          'source_root': str(root / 'source'), 'api_url': os.environ['BETTER_AUTH_URL'],
          'web_url': os.environ['CORS_ORIGIN'], 'DATABASE_URL': os.environ['DATABASE_URL'],
          'credentials': {role: json.loads((root / f'{role}.json').read_text()) for role in ['owner', 'user']},
          'source_sha': __import__('subprocess').check_output(['git', '-C', workspace, 'rev-parse', 'HEAD'], text=True).strip(),
          'restart': {'api': shlex.join(['python3', str(root / 'services.py'), 'restart', 'api']), 'web': shlex.join(['python3', str(root / 'services.py'), 'restart', 'web']),
                      'all': shlex.join(['bash', script, workspace, 'down']) + ' && ' + shlex.join(['bash', script, workspace, 'up'])},
          'down': shlex.join(['bash', script, workspace, 'down'])}
(root / 'result.json').write_text(json.dumps(result) + '\n')
PY
trap - ERR
cat "$runtime/result.json"
