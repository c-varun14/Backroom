"""Minimal plain-code Switch WS client: registration is kept by setup.py."""
import json
import threading
import time
import uuid
from urllib.parse import urlencode
from websockets.sync.client import connect
from common import API, show


class DeskClient(API):
    def __init__(self, agent, rooms=(), scope='all', connection_id=None):
        self.connection_id = connection_id or str(uuid.uuid4())
        super().__init__(agent=agent, connection=self.connection_id)
        query = urlencode({'connection_id': self.connection_id, 'scope': scope, 'filter': 'all', 'rooms': ','.join(rooms), 'start_from': 'head', 'client': 'backroom-block0-code'})
        url = 'ws://127.0.0.1:8000/agents/' + agent['id'] + '/connection/ws?' + query
        self.ws = connect(url, additional_headers={'Authorization': 'Bearer ' + agent['api_key']})
        self.frames = []
        self.cursor = 0
        self.running = True
        self.thread = threading.Thread(target=self._receive, daemon=True)
        self.thread.start()
        time.sleep(.3)

    def _receive(self):
        try:
            while self.running:
                frame = json.loads(self.ws.recv())
                self.frames.append(frame)
                kind = frame.get('event', frame.get('type'))
                data = frame.get('data', frame)
                if kind == 'ping':
                    self.ws.send(json.dumps({'type': 'pong', 'cursor': self.cursor}))
                else:
                    show({'ws_frame': frame})
                self.cursor = max(self.cursor, data.get('seq', 0), data.get('cursor', 0))
        except Exception as e:
            if self.running:
                show({'socket_end': type(e).__name__, 'detail': str(e)})

    def close(self):
        self.running = False
        self.ws.close()
        self.thread.join(timeout=3)


if __name__ == '__main__':
    from common import load
    state = load()
    client = DeskClient(state['desk'], [state[n]['id'] for n in ('client-test', 'studio-test')])
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        client.close()
