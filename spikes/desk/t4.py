"""Client-room wall probes against the real pinned Switch server."""
import secrets
import time
from common import API, load, owner_api, save, show
from client import DeskClient

state = load()
owner, user = owner_api()
client_room, studio_room = (state[n]['id'] for n in ('client-test', 'studio-test'))


def register(name, key):
    api = API()
    api.session.headers['Authorization'] = 'Bearer ' + key
    r, agent = api.request('POST', '/agents', {'name': name, 'description': 'SAMPLE permission probe; plain code', 'connector_type': 'backroom-kill-test', 'integration_profile': {'connection_model': 'always_on', 'message_exchange': True, 'pre_invocation_mediation': [], 'post_invocation_mediation': [], 'event_reporting': []}})
    r.raise_for_status()
    return agent


if 'test-builder' not in state:
    state['test-builder'] = register('test-builder', state['registration_token'])
    save(state)
builder = state['test-builder']
r, _ = owner.request('POST', f'/gateway/rooms/{studio_room}/agents', {'agent_ids': [builder['id']]})
r.raise_for_status()


def probes(agent, label):
    print('\nPROBE VARIANT:', label)
    socket = DeskClient(agent, [studio_room], scope='single')
    results = {}
    try:
        # post_message has no room_id argument in this release. Show that
        # injected room selectors are rejected and document its binding rule.
        r, result = socket.op('post_message', {'body': 'SAMPLE forbidden client attempt', 'room_id': client_room})
        results['post_message with client selector'] = r.status_code
        r, result = socket.request('POST', f'/agents/{agent["id"]}/message', {'room_id': client_room, 'content': 'SAMPLE forbidden direct post'})
        results['POST /message'] = r.status_code
        r, result = socket.op('connect_to_room', {'room_id': client_room, 'include_general_instructions': False})
        results['connect_to_room'] = r.status_code
        r, result = socket.op('read_context', {'room_id': client_room, 'limit': 1})
        results['read_context'] = r.status_code
        r, result = socket.op('add_users_to_room', {'room_id': client_room, 'user_names': ['SAMPLE-NONEXISTENT-USER']})
        results['add_users_to_room'] = r.status_code
        r, result = socket.op('create_room', {'name': 'wall-created-' + label, 'description': 'SAMPLE independent throwaway room', 'agent_names': [label], 'internal_only': True, 'read_visibility': 'private', 'write_visibility': 'private'})
        results['create_room'] = r.status_code
        r, result = socket.op('link_rooms', {'source_room_id': client_room, 'target_room_id': studio_room, 'label': 'SAMPLE client-to-studio probe'})
        results['link_rooms client source'] = r.status_code
        r, result = socket.op('link_rooms', {'source_room_id': studio_room, 'target_room_id': client_room, 'label': 'SAMPLE studio-to-client probe'})
        results['link_rooms studio source'] = r.status_code
        r, result = socket.op('invite_agent_to_room', {'room_id': client_room, 'agent_name': label})
        results['invite_agent_to_room self'] = r.status_code
        if r.status_code == 200:
            r, result = socket.op('connect_to_room', {'room_id': client_room, 'include_general_instructions': False})
            results['connect after self invite'] = r.status_code
            r, result = socket.op('post_message', {'body': 'SAMPLE WALL BREACH: self-invited agent posted to client room'})
            results['post_message after self invite'] = r.status_code
            r, result = socket.request('POST', f'/agents/{agent["id"]}/message', {'room_id': client_room, 'content': 'SAMPLE WALL BREACH: direct post after self invite'})
            results['POST /message after self invite'] = r.status_code
            r, result = socket.op('read_context', {'room_id': client_room, 'limit': 1})
            results['read_context after self invite'] = r.status_code
            r, _ = owner.request('DELETE', f'/gateway/rooms/{client_room}/agents/{agent["id"]}')
            r.raise_for_status()
    finally:
        socket.close()
    show({'variant': label, 'responses': results})
    return results


same_owner = probes(builder, 'test-builder')

# Also verify another agent cannot stamp the authenticated owner's identity.
desk = DeskClient(state['desk'], [studio_room], scope='single')
try:
    api = API(agent=builder)
    r, _ = api.request('POST', f'/agents/{builder["id"]}/message', {'room_id': studio_room, 'content': 'SAMPLE another-agent identity forgery attempt', 'sender': user['id'], 'sender_id': user['id'], 'sender_kind': 'user'})
    r.raise_for_status()
    time.sleep(1)
    frames = [f['data'] for f in desk.frames if f.get('event') == 'message' and f['data']['payload']['body'] == 'SAMPLE another-agent identity forgery attempt']
    assert frames and frames[-1]['payload']['sender'] != '@switch-member-' + user['id'] + ':localhost'
    print('IDENTITY: second agent supplied human sender fields; Switch recorded its agent sender instead.')
finally:
    desk.close()

# Separate, non-admin Switch owner for the builder, leaving desk with its
# original owner. This tests the server boundary rather than hiding MCP tools.
if 'isolated_owner' not in state:
    password = secrets.token_hex(24)
    r, isolated_user = owner.request('POST', '/gateway/users', {'name': 'SAMPLE Builder Owner', 'email': 'builder-owner@backroom.example', 'password': password, 'role': 'user'})
    r.raise_for_status()
    state['isolated_owner'] = {'user': isolated_user, 'password': password}
    save(state)
isolated = API()
r, _ = isolated.request('POST', '/gateway/auth/login', {'email': state['isolated_owner']['user']['email'], 'password': state['isolated_owner']['password']})
r.raise_for_status()
if 'isolated_registration_token' not in state:
    r, key = isolated.request('POST', '/gateway/api-keys', {'label': 'Block 0 separate owner'})
    r.raise_for_status()
    state['isolated_registration_token'] = key['key']
    save(state)
if 'isolated-builder' not in state:
    state['isolated-builder'] = register('isolated-builder', state['isolated_registration_token'])
    save(state)
isolated_agent = state['isolated-builder']
r, _ = owner.request('POST', f'/gateway/rooms/{studio_room}/agents', {'agent_ids': [isolated_agent['id']]})
r.raise_for_status()
separate_owner = probes(isolated_agent, 'isolated-builder')
state['t4_results'] = {'same_owner': same_owner, 'separate_owner': separate_owner}
save(state)
print('T4 completed. Same-owner self-enrollment must be judged from actual results; separate-owner responses are recorded for every requested route.')
