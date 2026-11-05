"""Stop only Block 0 provider agents and record their final observable state."""
import time
from common import owner_api, load, save, show, ROOT

state = load()
api, _ = owner_api()
room = state['studio-test']['id']
r, activity = api.request('GET', f'/gateway/chats/{room}/activity', quiet=True)
if r.status_code == 200:
    items = activity['items']
    show({'last_probe_activity': [{k: i.get(k) for k in ('agentId','kind','status','title','text')} for i in items[-5:]], 'approvals': activity['approvals']})
probe = ROOT / 'spikes/providers/switch-claude/SAMPLE-approval.txt'
show({'approval_probe_file_exists': probe.exists()})
r, machines = api.request('GET','/gateway/management/controllers',quiet=True)
r.raise_for_status()
machine = next(m for m in machines if m['id'] == state['controller_id'])
state['cleanup_session_ids'] = list({s for a in machine['status']['agents'] for s in a['sessions']['ids']})
save(state)
for name in ('switch-claude','switch-codex'):
    r, result = api.request('PATCH','/gateway/management/agents/' + state[name]['agent_id'], {'desired_state':'stopped'}, quiet=True)
    r.raise_for_status()
    show({'name':result['name'],'desired_state':result['desired_state'],'revision':result['revision']})
for _ in range(15):
    r, machines = api.request('GET','/gateway/management/controllers',quiet=True)
    machine = next(m for m in machines if m['id'] == state['controller_id'])
    agents = machine['status']['agents']
    if all(a['process'] == 'stopped' and a['sessions']['active'] == 0 for a in agents):
        show({'final_provider_state': agents})
        print('Block 0 provider agents stopped; no active sessions.')
        break
    time.sleep(1)
else:
    show({'provider_shutdown_state': agents})
    print('Provider shutdown still in progress; controller stop will finish it.')
