"""Register the plain-code desk and create the two unbridged test rooms."""
from common import API, load, owner_api, save, show, ROOT

state = load()
owner, user = owner_api()
state['owner'] = user
if 'registration_token' not in state:
    r, key = owner.request('POST', '/gateway/api-keys', {'label': 'Block 0 disposable registration'})
    r.raise_for_status()
    state['registration_token'] = key['key']
    save(state)
if 'desk' not in state:
    registrar = API()
    registrar.session.headers['Authorization'] = 'Bearer ' + state['registration_token']
    r, agent = registrar.request('POST', '/agents', {
        'name': 'desk', 'description': 'SAMPLE Block 0 plain code client, no AI',
        'connector_type': 'backroom-plain-code-spike',
        'integration_profile': {'connection_model': 'always_on', 'message_exchange': True, 'pre_invocation_mediation': [], 'post_invocation_mediation': [], 'event_reporting': []}
    })
    r.raise_for_status()
    state['desk'] = agent
    save(state)
for name in ['client-test', 'studio-test']:
    if name not in state:
        r, room = owner.request('POST', '/gateway/rooms', {
            'name': name, 'description': 'SAMPLE isolated Block 0 kill test',
            'internal_only': True, 'agent_ids': [state['desk']['id']],
            'read_visibility': 'private', 'write_visibility': 'private'
        })
        r.raise_for_status()
        state[name] = room
        save(state)
desk = API(agent=state['desk'])
r, ops = desk.request('GET', '/agents/' + state['desk']['id'] + '/ops', quiet=True)
r.raise_for_status()
(ROOT / '.switch-runtime/ops.json').write_text(__import__('json').dumps(ops, indent=2))
show({'operations': list(ops['operations'])})
r, version = desk.request('GET', '/version')
print('SETUP COMPLETE: desk and two private, unbridged rooms; credentials stored only in .secrets/spike-state.json')
