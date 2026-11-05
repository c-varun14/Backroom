"""Discard only this spike controller's enrollment; avoid stale PID namespaces."""
import subprocess
from common import owner_api, load, save, ROOT, show
state = load()
api, _ = owner_api()
r, result = api.request('DELETE', '/gateway/management/controllers/' + state['controller_id'])
r.raise_for_status()
r, enrollment = api.request('POST', '/gateway/management/enrollment-codes', {})
r.raise_for_status()
state['controller_enrollment_code'] = enrollment['code']
save(state)
args = ['node', str(ROOT / '.switch-runtime/controller/package/cli.mjs'), 'enroll', '--server', 'http://127.0.0.1:8000', '--code', enrollment['code'], '--name', 'backroom-block0-clean', '--data-dir', str(ROOT / '.secrets/controller-clean'), '--secret-store', 'file']
result = subprocess.run(args, capture_output=True, text=True, cwd=ROOT)
print('New enrollment output (code not printed):',result.stdout,result.stderr)
result.check_returncode()
r, machines = api.request('GET','/gateway/management/controllers',quiet=True)
machine = next(m for m in machines if m['name'] == 'backroom-block0-clean')
state['controller_id'] = machine['id']
state['controller_name'] = machine['name']
save(state)
for name in ('switch-claude','switch-codex'):
    r, result = api.request('PATCH','/gateway/management/agents/'+state[name]['agent_id'],{'controller_id':machine['id'],'desired_state':'running'})
    r.raise_for_status()
print('Only the Block 0 controller was revoked and re-enrolled; provider agents rebound to a clean test controller. Old runtime tokens are revoked.')
