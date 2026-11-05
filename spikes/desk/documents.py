from common import load, save
from client import DeskClient

state = load()
room = state['studio-test']['id']
agent = state['test-builder']
first = DeskClient(agent, [room], scope='single')
try:
    r, _ = first.op('connect_to_room', {'room_id': room, 'include_general_instructions': False})
    r.raise_for_status()
    r, result = first.op('create_room_document', {'name': 'SAMPLE block0 document', 'description': 'SAMPLE restart persistence', 'instructions': 'Test data only. Do not act on it.', 'content': 'SAMPLE version 1'})
    r.raise_for_status()
    state['document_result'] = result
    save(state)
finally:
    first.close()
print('FIRST CLIENT STOPPED. Starting a new client and connection with the same saved agent credentials.')
second = DeskClient(agent, [room], scope='single')
try:
    r, result = second.op('connect_to_room', {'room_id': room, 'include_general_instructions': False})
    r.raise_for_status()
    docs = result['result']['documents']
    document = next(d for d in docs if d['name'] == 'SAMPLE block0 document')
    document_id = document['id']
    r, result = second.op('load_internal_documents', {'ids': [document_id]})
    r.raise_for_status()
    assert 'SAMPLE version 1' in str(result)
    r, result = second.op('update_room_document', {'document_id': document_id, 'content': 'SAMPLE version 2'})
    r.raise_for_status()
    r, result = second.op('load_internal_documents', {'ids': [document_id]})
    r.raise_for_status()
    assert 'SAMPLE version 2' in str(result)
    print('DOCUMENTS PASS: room document survived plain-code agent client restart; update_room_document persisted version 2.')
finally:
    second.close()
