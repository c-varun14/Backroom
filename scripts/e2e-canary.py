#!/usr/bin/env python3
"""Run ordered Backroom canary probes and report the first broken hop."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

HOPS = ('Discord door', 'Switch', 'desk health', 'lead reply', 'GitHub',
        'broker read', 'host backroom-env check', 'client reply path', 'agent doctor')
LABEL = '[BACKROOM CANARY — fictional sample; never a client request]'


def run(command, timeout=30):
    try:
        return subprocess.run(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                              stderr=subprocess.DEVNULL, timeout=timeout).returncode == 0
    except Exception:
        return False


def probe(hop, workspace, checks=None):
    """A small injectable ordered runner; live adapters can supply exact probes."""
    if checks is not None:
        return bool(checks[hop]())
    if hop == 'Switch':
        try:
            with urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4) as response:
                return response.status == 200
        except Exception:
            return False
    if hop == 'agent doctor':
        return run([sys.executable, '-I', str(Path(__file__).with_name('agent-doctor.py')),
                    '--workspace', str(workspace)], timeout=180)
    command_var = 'BACKROOM_CANARY_' + hop.upper().replace(' ', '_').replace('-', '_')
    raw_command = os.environ.get(command_var)
    if not raw_command:
        return False
    try:
        command = json.loads(raw_command)
        if not isinstance(command, list) or not command or any(not isinstance(part, str) for part in command):
            return False
    except ValueError:
        return False
    # Each configured probe owns its own service integration and receives the
    # label. Its output is deliberately discarded to prevent credential leaks.
    env = {**os.environ, 'BACKROOM_CANARY_LABEL': LABEL}
    try:
        return subprocess.run(command, stdin=subprocess.DEVNULL,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                              env=env, timeout=60).returncode == 0
    except Exception:
        return False


def run_canary(workspace, checks=None):
    for hop in HOPS:
        if not probe(hop, workspace, checks):
            print(f'FAIL first broken hop: {hop}')
            return False
        print(f'PASS {hop}')
    print('PASS e2e canary')
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    args = parser.parse_args()
    room_id = os.environ.get('BACKROOM_CANARY_ROOM_ID')
    if not room_id:
        print('FAIL first broken hop: Discord door (set the dedicated canary room)')
        raise SystemExit(1)
    # Refuse any destination already recorded as a client-facing Switch room.
    projects = Path(__file__).resolve().parents[1] / '.switch-runtime/projects'
    try:
        for config in projects.glob('*.json'):
            value = json.loads(config.read_text())
            if room_id in {value.get('clientRoomId'), value.get('clientForumId'), value.get('discordForumId')}:
                print('FAIL first broken hop: Discord door (canary destination is a client room)')
                raise SystemExit(1)
    except (OSError, ValueError):
        print('FAIL first broken hop: Discord door (cannot verify canary destination)')
        raise SystemExit(1)
    raise SystemExit(0 if run_canary(args.workspace) else 1)


if __name__ == '__main__':
    main()
