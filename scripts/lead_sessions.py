"""Repair only the real Stage 1 lead's persisted room placements.

The local relay derives X-Switch-Room-Id from this placement map. Preserve
session evidence under .secrets; never print credentials or provider output.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import time
import requests

from block1_setup import ROOT, PUBLIC, SetupError, lead_session, call


def repair(fresh=False, restart=False):
    config = json.loads(PUBLIC.read_text())
    if config['projectId'] != 'morrowcrumb' or not config.get('workRoomId'):
        raise SetupError('Real Stage 1 work-room configuration required')
    session = lead_session()
    agents = call(session, 'GET', '/gateway/management/agents')
    assigned = [a for a in agents if a.get('controller_id') == config['controllerId']]
    if len(assigned) != 1 or assigned[0]['agent_id'] != config['leadId'] or assigned[0]['name'] != 'lead':
        raise SetupError('Refusing to restart a controller not dedicated to the real lead')
    state = ROOT / '.secrets/block1-lead-controller'
    watcher = state / 'watchers' / config['leadId']
    path = watcher / 'placements.json'
    placements = json.loads(path.read_text()).get('placements', {}) if path.exists() else {}
    stale = any(room != config['workRoomId'] for room in placements.values())
    reset = fresh or stale
    if not reset and not restart:
        print('lead placements: work room only; no repair needed')
        return
    known = []
    for sid in placements if reset else []:
        source = Path.home() / '.local/state/switch/sdk-sessions' / hashlib.sha256(sid.encode()).hexdigest()
        if not source.exists():
            continue
        saved = json.loads((source / 'config.json').read_text())
        if saved['session']['agentId'] != config['leadId'] or Path(saved['start']['input']['cwd']).resolve() != ROOT / 'spikes/providers/lead':
            raise SetupError('Session ownership check failed; no session state changed')
        known.append(source)
    call(session, 'PATCH', '/gateway/management/agents/' + config['leadId'], {'desired_state': 'stopped'})
    for _ in range(40):
        rows = call(session, 'GET', '/gateway/management/agents')
        agent = next(a for a in rows if a['agent_id'] == config['leadId'])
        if (agent.get('status') or {}).get('process') in ('stopped', 'absent'):
            break
        time.sleep(0.5)
    else:
        raise SetupError('Lead did not stop; no session state archived')
    # This controller is dedicated to lead, as checked above. A clean restart
    # also removes its stale in-memory relay placement cache.
    pidfile = ROOT / '.switch-runtime/block1-controller.pid'
    pid = int(pidfile.read_text())
    command = Path(f'/proc/{pid}/cmdline').read_bytes()
    if str(ROOT / '.switch-runtime/controller/package/cli.mjs').encode() not in command or b'block1-lead-controller' not in command:
        raise SetupError('Controller process ownership check failed')
    os.kill(pid, signal.SIGTERM)
    for _ in range(40):
        try:
            if not Path(f'/proc/{pid}/cmdline').read_bytes():
                break
        except OSError:
            break
        time.sleep(0.25)
    else:
        raise SetupError('Lead controller did not stop; no session state archived')
    if reset:
        archive = ROOT / '.secrets' / ('lead-session-archive-' + str(time.time_ns()))
        archive.mkdir(mode=0o700)
        for source in known:
            shutil.move(str(source), str(archive / source.name))
        if path.exists():
            shutil.copy2(path, archive / 'placements.json')
        path.write_text(json.dumps({'placements': {}}))
        path.chmod(0o600)
        print('lead sessions: archived ' + str(len(known)) + '; stale placements cleared')
    else:
        print('lead restart: preserving work-room state; no stale studio placement')
    from block1_runtime import start
    start('controller', ['node', str(ROOT / '.switch-runtime/controller/package/cli.mjs'), 'run', '--data-dir', str(state)], 'block1-lead-controller')
    for attempt in range(3):
        try:
            call(session, 'PATCH', '/gateway/management/agents/' + config['leadId'], {'desired_state': 'running'})
            break
        except (requests.RequestException, SetupError):
            if attempt == 2:
                raise SetupError('Lead running-state update failed after controller restart; rerun after checking status')
            time.sleep(1)
    print('real lead restarted; next handoff uses work-morrowcrumb')


if __name__ == '__main__':
    import sys
    try:
        repair(fresh='--fresh' in sys.argv, restart='--restart' in sys.argv)
    except SetupError as error:
        print(str(error))  # Fixed setup errors/statuses only, never response bodies.
        raise SystemExit(1)
    except Exception as error:
        print('Lead session repair stopped (' + type(error).__name__ + '); sensitive details withheld. Check lead status before retrying.')
        raise SystemExit(1)
