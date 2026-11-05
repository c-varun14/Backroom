from common import owner_api, load, show
state = load()
api, _ = owner_api()
r, machines = api.request('GET', '/gateway/management/controllers', quiet=True)
r.raise_for_status()
for m in machines:
    show({'machine': m['name'], 'state': m['state'], 'version': m['version'], 'connection': m['connection'], 'providers': (m.get('status') or {}).get('providers'), 'agents': (m.get('status') or {}).get('agents')})
r, operations = api.request('GET', '/gateway/management/operations', quiet=True)
show({'management_operations': operations})
room = state['studio-test']['id']
r, activity = api.request('GET', f'/gateway/chats/{room}/activity', quiet=True)
if r.status_code == 200:
    show({'room_activity': activity})
