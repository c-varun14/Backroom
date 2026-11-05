import time
import uuid
from common import owner_api, load, show, save
from client import DeskClient

state = load()
owner, _ = owner_api()
room = state['studio-test']['id']
desk = DeskClient(state['desk'], [room], scope='single')
try:
    r, result = owner.request('POST', f'/gateway/chats/{room}/messages', {'requestId': str(uuid.uuid4()), 'body': '@switch-claude SAMPLE Block 0: perform the tiny handoff once now, then stop. No product work.', 'mentionAgentId': state['switch-claude']['agent_id']})
    r.raise_for_status()
    state['t5_trigger'] = result
    save(state)
    end = time.monotonic() + 45
    while time.monotonic() < end:
        frames = [f['data'] for f in desk.frames if f.get('event') == 'message']
        if any(f['payload']['body'] == 'SAMPLE FOUR' for f in frames):
            print('T5 HANDOFF RESULT: SAMPLE FOUR observed in studio-test; verify server sender identities in the recorded events.')
            state['t5_frames'] = frames
            save(state)
            break
        time.sleep(1)
    else:
        print('T5 HANDOFF INCOMPLETE after 45 seconds. Inspect session activity; do not infer success from registration.')
        r, activity = owner.request('GET', f'/gateway/chats/{room}/activity')
        raise SystemExit(2)
finally:
    desk.close()
