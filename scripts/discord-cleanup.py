"""One-time cleanup before a demo. The owner runs this; it deletes real Discord data.

Removes the old test channels and roles, and adds START HERE, PROJECTS and STUDIO
categories. Safe to run again. Prints names and status codes only, never credentials.
"""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

import requests

sys.path.insert(0, 'scripts')
from block1_setup import BASE, call, lead_session, owner_session

API = 'https://discord.com/api/v10'
PROJECT = Path('.switch-runtime/projects/client-a-orders.json')
OLD_ROOMS = ('general', 'client-client-a', 'studio-client-a', 'client-client-a-orders')
OLD_AGENTS = ('builder-client-a', 'front-client-a-orders', 'lead', 'lead-client-a-orders',
              'reviewer-client-a-standby')
OLD_CHANNELS = ('client-client-a', 'studio-client-a', 'client-a-orders', 'general', 'General',
                'Text Channels', 'Voice Channels')
KEEP_ROLES = {'@everyone', 'Backroom', 'Lead', 'Team', 'Client', 'desk'}
BOARD_COLUMNS = ('New', 'Ready for Dev', 'In progress', 'Waiting on client', 'Done', 'Paused')

pairs = (line.strip().split('=', 1) for line in open('.secrets/discord.env') if '=' in line)
env = {key: value.strip('"\'') for key, value in pairs}
guild = env['DISCORD_GUILD_ID']
headers = {'Authorization': 'Bot ' + env['DISCORD_BOT_TOKEN']}


def discord(method, path, **options):
    for _ in range(8):
        response = requests.request(method, API + path, headers=headers, timeout=20, **options)
        if response.status_code != 429:
            return response
        time.sleep(float(response.json().get('retry_after', 1)) + 0.3)
    return response


def stop_desks():
    found = subprocess.run(['pgrep', '-af', 'desk/src/main.ts'], capture_output=True, text=True).stdout
    for line in found.splitlines():
        pid, command = line.split(' ', 1)
        if command.startswith('bun'):
            os.kill(int(pid), signal.SIGTERM)
            print('stopped desk', pid)


def forget_project():
    if not PROJECT.exists():
        return None
    config = json.loads(PROJECT.read_text())
    archive = Path('.switch-runtime/archive/projects')
    archive.mkdir(parents=True, exist_ok=True)
    shutil.move(str(PROJECT), archive / PROJECT.name)
    print('archived project config')
    return config


def stop_agents():
    session = lead_session()
    for agent in call(session, 'GET', '/gateway/management/agents'):
        if agent['name'] in OLD_AGENTS and agent.get('desired_state') == 'running':
            call(session, 'PATCH', '/gateway/management/agents/' + agent['agent_id'], {'desired_state': 'stopped'})
            print('stopped agent', agent['name'])


def archive_rooms():
    admin, _ = owner_session()
    rooms = call(admin, 'GET', '/gateway/rooms')
    rooms = rooms.get('rooms', rooms) if isinstance(rooms, dict) else rooms
    for room in rooms:
        if room['name'] in OLD_ROOMS:
            print('archive room', room['name'], admin.post(f"{BASE}/gateway/rooms/{room['id']}/archive", timeout=30).status_code)


def clean_channels(config):
    channels = {channel['name']: channel for channel in discord('GET', f'/guilds/{guild}/channels').json()}
    if config and config.get('studioDiscordThread'):
        print('delete studio post', discord('DELETE', f"/channels/{config['studioDiscordThread']}").status_code)
    for name in OLD_CHANNELS:
        if name in channels:
            print('delete', name, discord('DELETE', f"/channels/{channels[name]['id']}").status_code)

    def category(name, overwrites=None):
        if name in channels and channels[name]['type'] == 4:
            return channels[name]['id']
        body = {'name': name, 'type': 4, **({'permission_overwrites': overwrites} if overwrites else {})}
        return discord('POST', f'/guilds/{guild}/channels', json=body).json()['id']

    # Children keep their own permissions, so hiding STUDIO here is a second wall, not the only one.
    start = category('START HERE')
    projects = category('PROJECTS')
    studio = category('STUDIO', [{'id': guild, 'type': 0, 'allow': '0', 'deny': '1024'}])
    for name, parent in (('start-a-project', start), ('studio', studio)):
        print('move', name, discord('PATCH', f"/channels/{channels[name]['id']}",
                                    json={'parent_id': parent, 'lock_permissions': False}).status_code)
    Path('.switch-runtime/discord-layout.json').write_text(json.dumps({'projectsCategory': projects}))


def clean_roles():
    removed = failed = 0
    for role in discord('GET', f'/guilds/{guild}/roles').json():
        if role['name'] in KEEP_ROLES or role.get('managed'):
            continue
        if discord('DELETE', f"/guilds/{guild}/roles/{role['id']}").status_code == 204:
            removed += 1
        else:
            failed += 1
    print('roles removed', removed, 'failed', failed)


def reset_board():
    studio = json.loads(Path('.switch-runtime/studio.json').read_text())
    embeds = [{'title': name, 'description': '—'} for name in BOARD_COLUMNS]
    response = discord('PATCH', f"/channels/{studio['boardThread']}/messages/{studio['boardMessage']}",
                       json={'content': 'Studio project board', 'embeds': embeds})
    print('reset board', response.status_code)


stop_desks()
project = forget_project()
stop_agents()
archive_rooms()
clean_channels(project)
clean_roles()
reset_board()
subprocess.run(['bash', 'scripts/run-door.sh'], check=True)
print('Done. Discord is clean and the door has restarted.')
