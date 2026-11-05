"""Ask for one native tool permission, observe it in the room, then deny it."""
import time
import uuid
from common import owner_api, load, save, show, ROOT

state = load()
api, _ = owner_api()
agent_id = state['switch-claude']['agent_id']
room = state['studio-test']['id']
r, agent = api.request('GET', '/gateway/management/agents/' + agent_id, quiet=True)
r.raise_for_status()
definition = agent['definition']
state['claude_original_definition'] = definition
save(state)
probe_definition = dict(definition)
probe_definition['instructions'] = '''Only perform this authorized SAMPLE native approval test. Use Bash exactly once to run: printf 'SAMPLE native approval probe\\n' > SAMPLE-approval.txt . The working directory is your existing spike directory. Do not read anything or run any other commands. Wait for native permission. If denied, stop immediately. No product work, other projects, credentials, or containers. Do not mention another agent. If you must reply, use Switch post_message without mentions.'''
probe_definition['advanced_config'] = {'maxTurns': 4, 'effort': 'low', 'permissionMode': 'default', 'disallowedTools': ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Agent', 'WebSearch', 'WebFetch']}
r, _ = api.request('PATCH', '/gateway/management/agents/' + agent_id, {'definition': probe_definition})
r.raise_for_status()
time.sleep(3)
r, _ = api.request('POST', f'/gateway/chats/{room}/messages', {'requestId': str(uuid.uuid4()), 'body': '@switch-claude SAMPLE optional native approval probe: request the one Bash write described in your instructions, then await permission.', 'mentionAgentId': agent_id})
r.raise_for_status()
end = time.monotonic() + 45
try:
    while time.monotonic() < end:
        r, activity = api.request('GET', f'/gateway/chats/{room}/activity', quiet=True)
        r.raise_for_status()
        requests = [a for a in activity['approvals'] if a['agentId'] == agent_id and a['state'] in ('open', 'pending')]
        if requests:
            approval = requests[0]
            show({'native_approval_in_room_activity': approval})
            state['native_approval'] = approval
            save(state)
            # Resolve with deny so the test has no file mutation to approve.
            options = approval['options']
            deny = next(o for o in options if o.get('decision') == 'decline' or 'den' in o.get('label','').lower() or 'reject' in o.get('id','').lower())
            path = f'/gateway/agent-sessions/{agent_id}/{approval["sessionId"]}/approvals/{approval["requestId"]}/answer'
            r, _ = api.request('POST', path, {'answer': deny['id']})
            r.raise_for_status()
            print('NATIVE APPROVAL PASS: pending native Bash request present in studio-test room activity, then denied by authenticated owner. UI rendering has not been visually checked.')
            break
        time.sleep(1)
    else:
        print('NATIVE APPROVAL NOT OBSERVED within 45 seconds; do not claim room prompt support.')
        raise SystemExit(2)
finally:
    # Restoring the original bounded messaging definition also interrupts
    # any unresolved probe and removes Bash from its allowed actions again.
    r, _ = api.request('PATCH', '/gateway/management/agents/' + agent_id, {'definition': definition})
    r.raise_for_status()
