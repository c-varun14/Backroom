"""Archive only the two known Block 0 SDK sessions under the secret directory."""
import hashlib
import argparse
import json
from pathlib import Path
import shutil
from common import ROOT, load

state = load()
parser = argparse.ArgumentParser(description='Explicitly select historical sessions; no defaults')
parser.add_argument('--session-id', action='append', required=True)
known = set(parser.parse_args().session_id)
assert set(state['cleanup_session_ids']) <= known
target = ROOT / '.secrets/archived-sdk-sessions'
target.mkdir(mode=0o700, exist_ok=True)
allowed_agents = {state[n]['agent_id'] for n in ('switch-claude', 'switch-codex')}
for session_id in state['cleanup_session_ids']:
    digest = hashlib.sha256(session_id.encode()).hexdigest()
    source = Path.home() / '.local/state/switch/sdk-sessions' / digest
    if not source.exists():
        print('Explicitly selected historical session already absent; identity withheld')
        continue
    config = json.loads((source / 'config.json').read_text())
    assert config['session']['sessionId'] == session_id
    assert config['session']['agentId'] in allowed_agents
    destination = target / digest
    assert not destination.exists(), 'Refusing to overwrite archived state'
    shutil.move(str(source), str(destination))
    print('Archived explicitly selected stopped session; identity withheld')
print('No SDK session directory inventory was read; only the two known test session hashes were accessed.')
