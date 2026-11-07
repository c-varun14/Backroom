"""Owner step: archive named test rooms and remove named stopped test agents. Runs on dev as studio."""
import sys
sys.path.insert(0, 'scripts')
from block1_setup import BASE, call, lead_session, owner_session

ROOMS = {'studio-test', 'wall-created-test-builder', 'work-client-a', 'SAMPLE-forum-rehearsal-2b0d3e77-studio',
         'work-client-a-orders', 'studio-dryrun', 'studio-rehearsal', 'wall-created-isolated-builder',
         'SAMPLE-forum-rehearsal-2b0d3e77-client', 'client-test', 'SAMPLE-forum-rehearsal-2b0d3e77-work',
         'client-dryrun', 'work-dryrun', 'client-rehearsal'}
AGENTS = {'builder', 'builder-client-a', 'builder-client-a-orders', 'front-client-a-orders', 'lead',
          'lead-client-a-orders', 'lead-rehearsal', 'lead-rehearsal-sol', 'reviewer', 'reviewer-1', 'reviewer-2',
          'reviewer-3', 'reviewer-4', 'reviewer-client-a-orders', 'reviewer-client-a-standby'}


def rooms(session):
    found = call(session, 'GET', '/gateway/rooms')
    return found.get('rooms', found) if isinstance(found, dict) else found


owner, _ = owner_session()
for room in rooms(owner):
    if room['name'] in ROOMS:
        print('archive', room['name'], owner.post(f"{BASE}/gateway/rooms/{room['id']}/archive", timeout=30).status_code)
lead = lead_session()
for agent in call(lead, 'GET', '/gateway/management/agents'):
    if agent['name'] in AGENTS and agent.get('desired_state') != 'running':
        print('remove', agent['name'], lead.delete(f"{BASE}/gateway/management/agents/{agent['agent_id']}", timeout=30).status_code)
print('rooms left:', [room['name'] for room in rooms(owner)])
print('agents left:', [agent['name'] for agent in call(lead, 'GET', '/gateway/management/agents')])
