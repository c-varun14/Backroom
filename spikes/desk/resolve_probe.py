from common import owner_api, load, save, show
state = load()
api, _ = owner_api()
room = state['studio-test']['id']
r, activity = api.request('GET', f'/gateway/chats/{room}/activity', quiet=True)
r.raise_for_status()
for approval in activity['approvals']:
    if approval['agentId'] != state['switch-claude']['agent_id'] or approval['title'] != 'Write sample probe file':
        continue
    show({'native_approval_room_record': approval})
    state['native_approval'] = approval
    save(state)
    if approval['state'] == 'open':
        decline = next(o for o in approval['options'] if o.get('decision') == 'decline')
        path = f'/gateway/agent-sessions/{approval["agentId"]}/{approval["sessionId"]}/approvals/{approval["requestId"]}/answer'
        r, result = api.request('POST', path, {'answer': decline['id']})
        r.raise_for_status()
    print('NATIVE APPROVAL: observed real room-scoped request. Initial observer incorrectly expected pending instead of open. No UI visual check or reliability claim.')
