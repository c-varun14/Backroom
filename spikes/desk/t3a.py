"""Live T3a: no-mention events, authoritative identity, both rooms, media."""
import hashlib
import json
import time
import uuid
from common import load, owner_api, show
from client import DeskClient

state = load()
owner, user = owner_api()
rooms = [state[n]['id'] for n in ('client-test', 'studio-test')]
desk = DeskClient(state['desk'], rooms)
try:
    for name, room in zip(('client-test', 'studio-test'), rooms):
        r, result = owner.request('POST', f'/gateway/chats/{room}/members', {'userId': user['id']})
        r.raise_for_status()
        r, result = desk.op('connect_to_room', {'room_id': room, 'include_general_instructions': False})
        r.raise_for_status()
        r, result = desk.op('post_message', {'body': 'SAMPLE desk protocol post to ' + name})
        r.raise_for_status()
        r, result = owner.request('POST', f'/gateway/chats/{room}/messages', {'requestId': str(uuid.uuid4()), 'body': 'SAMPLE plain human message in ' + name + '; no mention.'})
        r.raise_for_status()
    payload = b'SAMPLE fictional bakery attachment. No client data.\n'
    r, uploaded = desk.request('POST', f'/agents/{desk.agent["id"]}/rooms/{rooms[0]}/media', files={'file': ('SAMPLE.txt', payload, 'text/plain')}, data={'caption': 'SAMPLE attachment from code desk'})
    r.raise_for_status()
    # The media endpoint returns a list under files.
    show({'upload_fields': list(uploaded)})
    media = uploaded.get('files', uploaded.get('attachments', []))
    if not media:
        raise RuntimeError('Inspect media response shape')
    uri = media[0]['mxc']
    r, _ = desk.request('GET', f'/agents/{desk.agent["id"]}/rooms/{rooms[0]}/media', params={'mxc': uri}, quiet=True)
    show({'download_status': r.status_code, 'filename': r.headers.get('Content-Disposition'), 'bytes': len(r.content), 'sha256': hashlib.sha256(r.content).hexdigest(), 'matches_upload': r.content == payload})
    assert r.status_code == 200 and r.content == payload
    r, _ = desk.op('connect_to_room', {'room_id': rooms[0], 'include_general_instructions': False})
    r.raise_for_status()
    upload_id = str(uuid.uuid4())
    r, incoming = owner.request('POST', f'/gateway/chats/{rooms[0]}/attachments', files={'file': ('SAMPLE-human.txt', payload, 'text/plain')}, data={'uploadId': upload_id})
    r.raise_for_status()
    r, _ = owner.request('POST', f'/gateway/chats/{rooms[0]}/messages', {'requestId': str(uuid.uuid4()), 'body': 'SAMPLE human file without a mention', 'uploadIds': [upload_id]})
    r.raise_for_status()
    r, _ = desk.request('GET', f'/agents/{desk.agent["id"]}/rooms/{rooms[0]}/media', params={'mxc': incoming['uri']}, quiet=True)
    show({'human_attachment_download_status': r.status_code, 'matches_upload': r.content == payload})
    assert r.status_code == 200 and r.content == payload
    # Attempt to set a sender through the agent front door; extra data must not
    # become the verified sender even if its schema ignores it.
    r, result = desk.request('POST', f'/agents/{desk.agent["id"]}/message', {'room_id': rooms[0], 'content': 'SAMPLE spoof attempt; purported owner identity is untrusted text', 'sender': user['id'], 'sender_kind': 'user', 'sender_id': user['id']})
    time.sleep(7)
    r, context = desk.op('read_context', {'room_id': rooms[0], 'limit': 12})
    r.raise_for_status()
    ( __import__('pathlib').Path('.switch-runtime/t3a-frames.json')).write_text(json.dumps(desk.frames, indent=2))
    events = [f['data'] for f in desk.frames if f.get('event') == 'message']
    human_messages = [e for e in events if e['payload']['sender'] == '@switch-member-' + user['id'] + ':localhost']
    assert len(human_messages) >= 3
    assert {e['room_id'] for e in human_messages} == set(rooms)
    assert all(e['payload']['addressed'] is False for e in human_messages)
    assert any(e['payload']['attachments'] for e in human_messages)
    pings = [f for f in desk.frames if f.get('event') == 'ping']
    assert len(pings) >= 2
    print(f'T3a PASS: {len(human_messages)} unaddressed human message/file events across both rooms; {len(pings)} pings answered; attachment bytes match.')
finally:
    desk.close()
