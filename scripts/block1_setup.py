"""Local Stage 1 provisioning. Credential files are never echoed or logged."""
import json
import os
from pathlib import Path
import subprocess
import time
import requests
import re
from harness_config import definition as harness_definition, provider_ready as harness_ready

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8000'
PUBLIC = Path(os.environ.get('BACKROOM_CLIENT_CONFIG', ROOT / '.switch-runtime/block1.json'))
PRIVATE = ROOT / '.secrets/block1-credentials.json'


class SetupError(Exception):
    pass


def env_field(path, name):
    for line in path.read_text().splitlines():
        if line.startswith(name + '='):
            return line.split('=', 1)[1].strip().strip('\"\'')
    raise SetupError('Required credential field missing: ' + name)


def private_field(path, *keys):
    value = json.loads(path.read_text())
    for key in keys:
        value = value[key]
    return value


def write_private(value):
    PRIVATE.write_text(json.dumps(value))
    PRIVATE.chmod(0o600)


def call(session, method, path, body=None):
    result = session.request(method, BASE + path, json=body, timeout=45)
    if not result.ok:
        # Validation errors can contain submitted credentials. Never echo them.
        error_code = result.json().get('error',{}).get('code','') if 'application/json' in result.headers.get('content-type','') else ''
        error_code = error_code if isinstance(error_code,str) and re.fullmatch('[a-z_]{1,60}',error_code) else 'withheld'
        raise SetupError(f'Switch {method} {path.split("?")[0]} HTTP {result.status_code}; error code {error_code}; response withheld')
    return result.json() if result.content else None


def owner_session():
    session = requests.Session()
    user = call(session, 'POST', '/gateway/auth/login', {
        'email': env_field(ROOT / '.secrets/switch.env', 'GATEWAY_ADMIN_EMAIL'),
        'password': env_field(ROOT / '.secrets/switch.env', 'GATEWAY_ADMIN_PASSWORD')})
    return session, user['id']


def lead_session():
    session = requests.Session()
    call(session, 'POST', '/gateway/auth/login', {
        'email': private_field(ROOT / '.secrets/spike-state.json', 'isolated_owner', 'user', 'email'),
        'password': private_field(ROOT / '.secrets/spike-state.json', 'isolated_owner', 'password')})
    return session


def bootstrap():
    admin, owner_id = owner_session()
    public = json.loads(PUBLIC.read_text()) if PUBLIC.exists() else {}
    private = json.loads(PRIVATE.read_text()) if PRIVATE.exists() else {}
    # Existing Block 0 identity: read the two needed fields only, never echo.
    if 'desk' not in private:
        private['desk'] = {'id': private_field(ROOT / '.secrets/spike-state.json', 'desk', 'id'),
                           'api_key': private_field(ROOT / '.secrets/spike-state.json', 'desk', 'api_key')}
        private['probe'] = {'id': private_field(ROOT / '.secrets/spike-state.json', 'isolated-builder', 'id'),
                            'api_key': private_field(ROOT / '.secrets/spike-state.json', 'isolated-builder', 'api_key')}
    if 'bridgeId' not in public:
        existing = call(admin, 'GET', '/gateway/collaborations')
        bridge = next((b for b in existing if b['display_name'] == 'Backroom Discord'), None)
        if bridge is None:
            bridge = call(admin, 'POST', '/gateway/collaborations', {
                'bridge_type': 'discord', 'display_name': 'Backroom Discord',
                'connection_config': {'bot_token': env_field(ROOT / '.secrets/discord.env', 'DISCORD_BOT_TOKEN'),
                                      'guild_id': env_field(ROOT / '.secrets/discord.env', 'DISCORD_GUILD_ID'),
                                      'agent_roles': True},
                'set_as_default': False, 'channel_creation_enabled': True})
        public['bridgeId'] = bridge['bridge_id']
        print('Discord bridge registered; credential response withheld.')
    # Suppress Switch's unsolicited agent greetings in the client room.
    call(admin, 'PATCH', '/gateway/collaborations/' + public['bridgeId'], {'agent_greetings_enabled': False})
    rooms = call(admin, 'GET', '/gateway/rooms')
    if isinstance(rooms, dict):
        rooms = rooms.get('rooms', [])
    for key, name in [('clientRoomId','client-client-a'),('studioRoomId','studio-client-a')]:
        if key not in public:
            room = next((r for r in rooms if r['name'] == name and r.get('bridge_id') == public['bridgeId']), None)
            if room is None:
                room = call(admin, 'POST', '/gateway/rooms', {'name': name, 'description': 'FICTIONAL SAMPLE — client-a Bakery, Stage 1 only',
                    'bridge_id': public['bridgeId'], 'channel_type': 'channel_private',
                    'agent_ids': [private['desk']['id']], 'read_visibility': 'private', 'write_visibility': 'private'})
            public[key] = room['id']
            public[key.replace('RoomId','ChannelId')] = room['external_channel_id']
            print('Private room provisioned: #' + name)
        call(admin, 'POST', f'/gateway/chats/{public[key]}/members', {'userId':owner_id})
    public.update(projectId='client-a', ownerId=owner_id, deskId=private['desk']['id'], probeId=private['probe']['id'])
    lead = lead_session()
    if 'controllerId' not in public:
        enrollment = call(lead, 'POST', '/gateway/management/enrollment-codes', {})
        private['controller_enrollment_code'] = enrollment['code']
        write_private(private)
        args = ['node', str(ROOT / '.switch-runtime/controller/package/cli.mjs'), 'enroll', '--server', BASE,
                '--code', enrollment['code'], '--name', 'backroom-stage1-lead', '--data-dir', str(ROOT / '.secrets/block1-lead-controller'), '--secret-store', 'file']
        result = subprocess.run(args, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if result.returncode:
            raise SetupError('Controller enrollment failed; output withheld')
        controllers = call(lead, 'GET', '/gateway/management/controllers')
        public['controllerId'] = next(c['id'] for c in controllers if c['name'] == 'backroom-stage1-lead')
        print('Separate non-admin lead controller enrolled; credential output suppressed.')
    write_private(private)
    PUBLIC.write_text(json.dumps(public, indent=2))


def configure_lead():
    public = json.loads(PUBLIC.read_text())
    admin, _ = owner_session()
    lead = lead_session()
    from harness_config import role_config, command_role
    if role_config('lead')['harness']=='command':
        if not public.get('workRoomId'):
            work=call(admin,'POST','/gateway/rooms',{'name':'work-'+public['projectId'],'internal_only':True,'channel_type':'channel_private','agent_ids':[public['deskId']],'read_visibility':'private','write_visibility':'private'})
            public['workRoomId']=work['id']
        agent=command_role(public,'lead','lead',ROOT/'.switch-runtime/providers/lead')
        public['leadId']=agent['id'];PUBLIC.write_text(json.dumps(public,indent=2))
        print('Configured command lead; work room only; no managed provider required.')
        return
    for _ in range(30):
        controllers = call(lead, 'GET', '/gateway/management/controllers')
        machine = next(c for c in controllers if c['id'] == public['controllerId'])
        provider_ready = harness_ready(machine, 'lead')
        if machine['state'] == 'online' and provider_ready:
            break
        time.sleep(1)
    else:
        raise SetupError('Lead controller/provider did not become ready; rerun scripts/up.sh after checking plan login')
    directory = ROOT / '.switch-runtime/providers/lead'
    directory.mkdir(parents=True, exist_ok=True)
    instructions = (ROOT / 'studio-kit/agents/lead.md').read_text().split('\n<!-- STAGE 1 END -->', 1)[0]
    if public.get('mode') == 'real':
        from real_setup import real_instructions
        instructions = real_instructions('lead', public)
    definition = {**harness_definition('lead'),'instructions':instructions,'auto_mode':False,'auto_approve':False,
        'directory':str(directory),'isolation':'shared', 'advanced_config':{'effort':'low','maxTurns':8,
        'disallowedTools':['Bash','Read','Write','Edit','Glob','Grep','Agent','WebSearch','WebFetch']}}
    agents = call(lead,'GET','/gateway/management/agents')
    agent = next((a for a in agents if a['name']=='lead'),None)
    if agent is None:
        agent = call(lead,'POST','/gateway/management/agents',{'name':'lead','description':'Stage 1 fictional bakery brief writer',
            'controller_id':public['controllerId'],'desired_state':'running','definition':definition})
    else:
        agent = call(lead,'PATCH','/gateway/management/agents/'+agent['agent_id'],{'controller_id':public['controllerId'],'desired_state':'running','definition':definition})
    public['leadId'] = agent['agent_id']
    # Machine traffic must not reach the Discord studio if thread placement
    # cannot be verified. Use the explicit unbridged fallback from studio-ux.
    rooms = call(admin, 'GET', '/gateway/rooms')
    if isinstance(rooms, dict):
        rooms = rooms.get('rooms', [])
    work = next((r for r in rooms if r['name'] == 'work-client-a' and not r.get('bridge_id')), None)
    if work is None:
        work = call(admin, 'POST', '/gateway/rooms', {
            'name': 'work-client-a', 'description': 'Private internal Stage 1 machine traffic; fictional SAMPLE only',
            'internal_only': True, 'channel_type': 'channel_private',
            'agent_ids': [public['deskId'], public['leadId']],
            'read_visibility': 'private', 'write_visibility': 'private'})
    public['workRoomId'] = work['id']
    call(admin, 'POST', f'/gateway/rooms/{work["id"]}/agents', {'agent_ids': [public['deskId'], public['leadId']]})
    call(admin, 'POST', f'/gateway/chats/{work["id"]}/members', {'userId': public['ownerId']})
    removed = admin.delete(BASE + f'/gateway/rooms/{public["studioRoomId"]}/agents/{public["leadId"]}', timeout=30)
    if removed.status_code not in (200, 204, 404):
        raise SetupError('Could not remove lead from bridged studio; response withheld')
    # A separate owner means owner-only addressing cannot accept Varun or desk.
    # Private room membership is the scope; lead accepts senders within it.
    call(lead,'PUT',f'/gateway/agents/{public["leadId"]}/addressing-policy', {'policy':None})
    PUBLIC.write_text(json.dumps(public,indent=2))
    from lead_sessions import repair
    repair()
    print('lead configured with strict client-text protocol; unbridged work-client-a only; studio receives desk cards.')


if __name__ == '__main__':
    import sys
    try:
        bootstrap() if len(sys.argv)<2 or sys.argv[1]=='bootstrap' else configure_lead()
    except SetupError as error:
        print(str(error))  # Only fixed paths/statuses constructed by call().
        raise SystemExit(1)
    except (requests.RequestException, KeyError, StopIteration):
        print('Stage 1 provisioning failed; raw exception and credential details suppressed.')
        raise SystemExit(1)
