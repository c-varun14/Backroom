"""Throwaway live-protocol helpers, restricted to the local Block 0 server."""
import json
from pathlib import Path
import re
import requests
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'spikes'))
from record import redact

BASE = 'http://127.0.0.1:8000'
STATE_FILE = ROOT / '.secrets/spike-state.json'


def save(state):
    STATE_FILE.write_text(json.dumps(state, indent=2))
    STATE_FILE.chmod(0o600)


def load():
    return json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}


def safe(value):
    if isinstance(value, dict):
        return {k: '<REDACTED>' if re.search(r'token|password|secret|credential|cookie|api_key', k, re.I) or (k == 'key' and isinstance(v, str) and len(v) >= 24) or (k == 'code' and 'expires_at' in value) else safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [safe(v) for v in value]
    return value


def show(value):
    print(redact(json.dumps(safe(value), ensure_ascii=False)))


class API:
    def __init__(self, session=None, agent=None, connection=None):
        self.session = session or requests.Session()
        self.agent = agent
        self.connection = connection
        if agent:
            self.session.headers['Authorization'] = 'Bearer ' + agent['api_key']
        if connection:
            self.session.headers['X-Switch-Connection-Id'] = connection

    def request(self, method, path, body=None, quiet=False, **kwargs):
        r = self.session.request(method, BASE + path, json=body, timeout=25, **kwargs)
        try:
            result = r.json()
        except ValueError:
            result = r.text
        if not quiet:
            show({'method': method, 'path': path, 'status': r.status_code, 'response': result})
        return r, result

    def op(self, name, args=None, quiet=False):
        return self.request('POST', '/agents/' + self.agent['id'] + '/ops/' + name, args or {}, quiet=quiet)


def owner_api():
    env = dict(line.split('=', 1) for line in (ROOT / '.secrets/switch.env').read_text().splitlines() if '=' in line)
    api = API()
    r, user = api.request('POST', '/gateway/auth/login', {'email': env['GATEWAY_ADMIN_EMAIL'], 'password': env['GATEWAY_ADMIN_PASSWORD']})
    r.raise_for_status()
    return api, user
