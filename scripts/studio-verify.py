#!/usr/bin/env python3
"""Run on dev as root. All output is fixed names/statuses, never raw responses."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import urllib.request

# Switch 0.31.0 has running/stopped desired states, not a retired column.
# Retired definitions stay stopped. Never update any definition in this check.
LAPTOP_PATH_SQL = """SELECT to_json(a.name)::text
    FROM agent_definitions d
    JOIN agents a ON a.tenant_id = d.tenant_id AND a.id = d.agent_id
    WHERE d.desired_state = 'running'
      AND (strpos(CAST(d.definition AS TEXT), :'laptop_root') > 0
           OR strpos(CAST(d.definition AS TEXT), :'laptop_home') > 0)
    ORDER BY a.name;"""


def definitions_with_laptop_paths(laptop_root, runner=subprocess.run):
    if not laptop_root.startswith('/') or laptop_root == '/':
        raise ValueError('laptop root required')
    # Also catch laptop tool/skill paths outside the checkout. The Fedora
    # laptop uses /home/<owner>; server /home/studio is a different identity.
    parts = Path(laptop_root).parts
    laptop_home = str(Path(*parts[:3])) + '/' if len(parts) > 3 and parts[1] == 'home' else laptop_root
    args = ['docker', 'compose', '-p', 'backroom-block0', '--env-file', '/srv/backroom/.secrets/switch.env',
            '-f', '/srv/backroom/.switch-runtime/compose.yml', '--profile', 'gateway',
            'exec', '-T', 'postgres', 'sh', '-c',
            'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1 -v laptop_root="$1" -v laptop_home="$2"',
            'sh', laptop_root, laptop_home]
    result = runner(args, input=LAPTOP_PATH_SQL, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError('definition check failed')
    names = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
    if any(not isinstance(name, str) for name in names):
        raise ValueError('invalid definition result')
    return names


def check_definition_paths(laptop_root, runner=subprocess.run):
    names = definitions_with_laptop_paths(laptop_root, runner)
    for name in names:
        print('agent definition: ' + json.dumps(name, ensure_ascii=True), flush=True)
    check('running agent definition paths', not names)


def command(args):
    return subprocess.run(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def check(name, okay):
    print(name + (': passed' if okay else ': FAILED'), flush=True)
    if not okay:
        raise RuntimeError('verification failed')


def controller_connected(controller_id, runner=subprocess.run):
    sql = """SELECT EXISTS (
      SELECT 1 FROM agent_controllers c
      JOIN switch_core_processes p ON p.id = c.connection_process_id
      WHERE c.id = :'controller_id' AND c.revoked_at IS NULL
        AND c.api_key_id IS NOT NULL AND c.connected_at IS NOT NULL
        AND c.disconnected_at IS NULL AND p.stopped_at IS NULL
        AND current_timestamp - p.beat_at < interval '15 seconds'
    );"""
    args = ['docker', 'compose', '-p', 'backroom-block0', '--env-file', '/srv/backroom/.secrets/switch.env',
            '-f', '/srv/backroom/.switch-runtime/compose.yml', '--profile', 'gateway',
            'exec', '-T', 'postgres', 'sh', '-c',
            'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1 -v controller_id="$1"',
            'sh', str(controller_id)]
    result = runner(args, input=sql, capture_output=True, text=True)
    return result.returncode == 0 and result.stdout.strip() == 't'


def main():
    if len(sys.argv) != 2:
        raise ValueError('laptop root required')
    check('root verifier', os.getuid() == 0)
    for name in ('backroom-switch', 'backroom-controller-lead', 'backroom-controller-build', 'backroom-studio'):
        check(name, command(['systemctl', 'is-active', '--quiet', name]))
    with urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=5) as response:
        check('Switch health', response.status == 200)
    # The management API lists only its caller's controllers, even for an
    # administrator. Root checks the same socket ledger + live process lease
    # as Switch's controller_state(), without a management login or mutation.
    config = json.loads(Path('/srv/backroom/.switch-runtime/block1.json').read_text())
    for key, name in [('controllerId', 'lead controller connected'), ('buildControllerId', 'build controller connected')]:
        check(name, controller_connected(config[key]))
    check_definition_paths(sys.argv[1])
    # Check the actual descendant, not merely systemd's supervisor process.
    processes = []
    for entry in Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                processes.append((entry / 'cmdline').read_bytes())
            except OSError:
                pass
    check('door process', any(b'bun\x00--no-env-file\x00desk/src/door.ts\x00' in p for p in processes))
    protected = ['/srv/backroom/.secrets', '/srv/backroom/.switch-runtime', '/root', '/home/studio',
                 '/home/studio/.ssh/dev-root', '/home/studio/.config/gh/hosts.yml', '/run/docker.sock']
    for path in protected:
        # Opening/listing, rather than test -r alone, checks directory traversal.
        code = 'import os,sys; p=sys.argv[1]; os.listdir(p) if os.path.isdir(p) else open(p,"rb").close()'
        check('protected path exists ' + path, os.path.exists(path))
        check('agent refused ' + path, not command(['runuser', '-u', 'agent', '--', 'python3', '-c', code, path]))
    for group in ('docker', 'wheel'):
        import grp
        import pwd
        uid = pwd.getpwnam('agent')
        gids = os.getgrouplist('agent', uid.pw_gid)
        check('agent excluded ' + group, group not in [grp.getgrgid(g).gr_name for g in gids])
    for address, family, tool in [('169.254.169.254', 'AF_INET', 'iptables'), ('fd00:ec2::254', 'AF_INET6', 'ip6tables')]:
        check('metadata firewall ' + family, command([tool, '-C', 'OUTPUT', '-m', 'owner', '--uid-owner', 'agent', '-d', address, '-j', 'REJECT']))
        # Require immediate denial (REJECT), not a network timeout that could
        # falsely suggest a firewall on a machine without metadata connectivity.
        code = ('import errno,socket,sys; s=socket.socket(socket.' + family + '); s.settimeout(3); '
                'r=s.connect_ex((sys.argv[1],80)); sys.exit(0 if r in (errno.EPERM,errno.EACCES,errno.ECONNREFUSED) else 1)')
        check('metadata denied ' + family, command(['runuser', '-u', 'agent', '--', 'python3', '-c', code, address]))
    for tool in ('iptables', 'ip6tables'):
        check('Switch database firewall ' + tool, command([tool, '-C', 'OUTPUT', '-m', 'owner', '--uid-owner', 'agent', '-p', 'tcp', '--dport', '5432', '-j', 'REJECT']))
    code = 'import socket,sys; s=socket.socket(); s.settimeout(3); sys.exit(0 if s.connect_ex(("127.0.0.1",5432))!=0 else 1)'
    check('Switch database denied', command(['runuser', '-u', 'agent', '--', 'python3', '-c', code]))
    check('studio localhost deploy access', command(['runuser', '-u', 'studio', '--', 'ssh', '-o', 'BatchMode=yes', 'backroom-dev', "cd /var/lib/backroom/fleet && exec cat hosts/settings.json"]))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('server verification: FAILED; details withheld', flush=True)
        raise SystemExit(1) from None
