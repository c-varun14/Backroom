#!/usr/bin/env python3
"""Real Backroom canary: probe every hop in order and name the first broken one.

Run on backroom-dev as the studio user:

    runuser -u studio -- python3 -I /srv/backroom/scripts/e2e-canary.py --project <slug>

Server hops are built in and run against the live services. Conversation hops
(Discord door, lead reply, client reply path) need a dedicated canary room and
run only when configured; otherwise they are reported NOT RUN, never PASS.
"""
import argparse
import calendar
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / '.switch-runtime'
CANARY_SLUG = 'backroom-canary'
WORKSPACES = ROOT / 'workspaces'
PROVISION_SOCKET = '/run/backroom-provision.sock'
IDENTITY_SOCKET = '/run/backroom-identity.sock'
STUDIO_SSH = '/opt/backroom/studio-bin/ssh'
SERVICES = ('backroom-switch', 'backroom-identity', 'backroom-provision',
            'backroom-controller-lead', 'backroom-controller-build', 'backroom-studio')
LABEL = '[BACKROOM CANARY — fictional sample; never a client request]'
SERVER_HOPS = ('Switch', 'studio services', 'identity helper', 'desk health', 'GitHub',
               'broker read', 'host backroom-env check', 'builder provisioning', 'agent doctor')
CONVERSATION_HOPS = ('Discord door', 'lead reply', 'client reply path')
HEALTH_MAX_AGE = 120


def quiet(command, timeout=30, env=None):
    try:
        return subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, timeout=timeout, env=env)
    except Exception:
        return None


def provision(operation, slug, timeout=200):
    with socket.socket(socket.AF_UNIX) as connection:
        connection.settimeout(timeout)
        connection.connect(PROVISION_SOCKET)
        connection.sendall(json.dumps({'operation': operation, 'project': slug}).encode() + b'\n')
        return json.loads(connection.makefile().readline())


def deploy_read(host, remote):
    """The same adapter and broker route NixDeployer uses."""
    return quiet([STUDIO_SSH, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '--', host, remote], timeout=60)


class Server:
    def __init__(self, project):
        self.project = project
        self.config = json.loads((RUNTIME / 'projects' / (project + '.json')).read_text())

    def check(self, hop):
        return getattr(self, 'hop_' + re.sub(r'[^a-z]+', '_', hop.lower()).strip('_'))()

    def hop_switch(self):
        try:
            with urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4) as response:
                return response.status == 200, 'Switch health'
        except Exception:
            return False, 'Switch health did not answer on 127.0.0.1:8000'

    def hop_studio_services(self):
        result = quiet(['systemctl', 'is-active', *SERVICES])
        states = result.stdout.decode().split() if result else []
        down = [name for name, state in zip(SERVICES, states) if state != 'active']
        if len(states) != len(SERVICES) or down:
            return False, 'not active: ' + ', '.join(down or SERVICES)
        # While the root-only sync barrier exists these units refuse to start,
        # so all-active also means no sync is incomplete.
        return True, 'all six units active'

    def hop_identity_helper(self):
        try:
            with socket.socket(socket.AF_UNIX) as connection:
                connection.settimeout(4)
                connection.connect(IDENTITY_SOCKET)
            return True, 'socket accepts connections'
        except OSError:
            return False, 'identity socket refused the connection'

    def hop_desk_health(self):
        try:
            health = json.loads(Path(self.config['healthFile']).read_text())
        except (OSError, ValueError, KeyError):
            return False, 'health file missing or unreadable'
        updated = health.get('updatedAt', '')
        try:
            age = time.time() - calendar.timegm(time.strptime(updated[:19], '%Y-%m-%dT%H:%M:%S'))
        except ValueError:
            return False, 'health file has no timestamp'
        if age > HEALTH_MAX_AGE:
            return False, f'health is {int(age)}s old'
        if not health.get('connectedRooms'):
            return False, 'desk has no connected rooms'
        return True, f"{health['connectedRooms']} rooms, stage {health.get('workflowStage')}"

    def hop_github(self):
        repo = self.config.get('github', {}).get('repo', '')
        if not re.fullmatch(r'[A-Za-z0-9-]+/[A-Za-z0-9._-]+', repo):
            return False, 'project has no GitHub repo'
        result = quiet(['gh', 'api', 'repos/' + repo, '--jq', '.private'])
        if not result or result.returncode != 0:
            return False, 'gh could not read ' + repo
        if result.stdout.decode().strip() != 'true':
            return False, repo + ' is not private'
        return True, repo + ' readable and private'

    def deploy_host(self):
        host = self.config.get('nixDeploy', {}).get('deployHost', '')
        if not re.fullmatch(r'root@\d{1,3}(?:\.\d{1,3}){3}', host):
            raise ValueError('no deploy host')
        return host

    def hop_broker_read(self):
        try:
            result = deploy_read(self.deploy_host(), 'exec readlink -f /nix/var/nix/profiles/system')
        except ValueError:
            return False, 'project has no deploy host'
        if not result or result.returncode != 0:
            return False, 'broker refused or host unreachable (exit ' + str(result and result.returncode) + ')'
        closure = result.stdout.decode().strip()
        if not re.fullmatch(r'/nix/store/[a-z0-9]{32}-nixos-system-[A-Za-z0-9._-]+', closure):
            return False, 'host returned no system closure'
        return True, 'host on ' + closure.split('/')[-1][:12]

    def hop_host_backroom_env_check(self):
        host = self.deploy_host()
        present = deploy_read(host, 'exec backroom-env check ' + self.project)
        absent = deploy_read(host, 'exec backroom-env check ' + self.project + ' BACKROOM_CANARY_ABSENT_KEY')
        if not present or present.returncode != 0:
            return False, 'key check failed for ' + self.project
        # The check must be able to fail: a made-up key is reported missing.
        if not absent or absent.returncode != 3 or b'missing: BACKROOM_CANARY_ABSENT_KEY' not in absent.stdout:
            return False, 'key check did not report a missing key'
        return True, 'answers, and reports a missing key'

    def canary_workspace(self):
        workspace = WORKSPACES / CANARY_SLUG
        if not (workspace / '.git').is_dir():
            env = {'PATH': os.environ.get('PATH', '/run/current-system/sw/bin'), 'HOME': os.environ.get('HOME', '/'),
                   'LANG': 'C.UTF-8', 'GIT_CONFIG_GLOBAL': '/dev/null'}
            os.umask(0o007)
            workspace.mkdir(exist_ok=True)
            (workspace / 'README.md').write_text(LABEL + '\n')
            for command in (['git', 'init', '-q', '-b', 'main'], ['git', 'add', 'README.md'],
                            ['git', '-c', 'user.name=Backroom Canary', '-c', 'user.email=canary@backroom.invalid',
                             'commit', '-qm', 'canary']):
                subprocess.run(command, cwd=workspace, env=env, check=True, stdin=subprocess.DEVNULL,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return workspace

    def hop_builder_provisioning(self):
        try:
            self.canary_workspace()
            result = provision('prepare-builder', CANARY_SLUG)
        except Exception as error:
            return False, 'could not reach the provision helper (' + type(error).__name__ + ')'
        if not result.get('ok'):
            return False, 'prepare-builder refused: ' + str(result.get('category'))
        return True, 'prepare-builder on ' + CANARY_SLUG

    def hop_agent_doctor(self):
        try:
            result = provision('doctor', self.project)
        except Exception as error:
            return False, 'could not reach the provision helper (' + type(error).__name__ + ')'
        if not result.get('ok'):
            failed = [line for line in str(result.get('output', '')).splitlines() if line.startswith('FAIL ')]
            return False, '; '.join(failed) or str(result.get('category'))
        return True, 'all checks pass for ' + self.project


def conversation(hop):
    """Configured probe: a JSON argument array in BACKROOM_CANARY_<HOP>."""
    raw = os.environ.get('BACKROOM_CANARY_' + re.sub(r'[^A-Z]+', '_', hop.upper()).strip('_'))
    if not raw:
        return None, 'needs a dedicated canary room'
    try:
        command = json.loads(raw)
        if not isinstance(command, list) or not command or any(not isinstance(part, str) for part in command):
            raise ValueError
    except ValueError:
        return False, 'probe command is not a JSON argument array'
    # Probe output is discarded so a credential can never reach this output.
    result = quiet(command, timeout=120, env={**os.environ, 'BACKROOM_CANARY_LABEL': LABEL})
    return bool(result and result.returncode == 0), 'configured probe'


def run_canary(server_check, conversation_check=conversation, require_conversation=False, out=print):
    for hop in SERVER_HOPS:
        try:
            ok, detail = server_check(hop)
        except Exception as error:
            ok, detail = False, type(error).__name__
        out(f"{'PASS' if ok else 'FAIL'} {hop} — {detail}")
        if not ok:
            out(f'FAIL first broken hop: {hop}')
            return False
    not_run = []
    for hop in CONVERSATION_HOPS:
        ok, detail = conversation_check(hop)
        if ok is None:
            not_run.append(hop)
            out(f'NOT RUN {hop} — {detail}')
            continue
        out(f"{'PASS' if ok else 'FAIL'} {hop} — {detail}")
        if not ok:
            out(f'FAIL first broken hop: {hop}')
            return False
    if not_run and require_conversation:
        out('FAIL conversation hops not run: ' + ', '.join(not_run))
        return False
    out('PASS server path' + (' (conversation hops not run)' if not_run else '; PASS e2e canary'))
    return True


def refuse_client_room(room_id):
    for config in (RUNTIME / 'projects').glob('*.json'):
        value = json.loads(config.read_text())
        if room_id in {value.get('clientRoomId'), value.get('clientForumId'), value.get('discordForumId')}:
            raise ValueError('canary destination is a client room')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', required=True)
    parser.add_argument('--require-conversation', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?', args.project):
        print('FAIL bad project slug')
        raise SystemExit(2)
    room_id = os.environ.get('BACKROOM_CANARY_ROOM_ID')
    if room_id:
        try:
            refuse_client_room(room_id)
        except (OSError, ValueError) as error:
            print('FAIL first broken hop: Discord door (' + str(error) + ')')
            raise SystemExit(1)
    try:
        server = Server(args.project)
    except (OSError, ValueError):
        print('FAIL no project record for ' + args.project)
        raise SystemExit(1)
    raise SystemExit(0 if run_canary(server.check, require_conversation=args.require_conversation) else 1)


if __name__ == '__main__':
    main()
