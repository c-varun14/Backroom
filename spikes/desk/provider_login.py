import json
import subprocess
from common import owner_api, ROOT, load, save

api, _ = owner_api()
state = load()
r, controllers = api.request('GET', '/gateway/management/controllers')
r.raise_for_status()
machine = next(c for c in controllers if c['id'] == state['controller_id'])
(ROOT / '.switch-runtime/controller-public.json').write_text(json.dumps(machine))
state['controller_id'] = machine['id']
save(state)
subprocess.run(['node', 'spikes/desk/seal-codex.mjs'], cwd=ROOT, check=True)
sealed = json.loads((ROOT / '.secrets/sealed-codex.json').read_text())
r, result = api.request('PUT', f'/gateway/management/controllers/{machine["id"]}/provider-logins/codex', sealed)
r.raise_for_status()
print('Provider login supplied through the released sealed-login API; wait for controller verification before claiming success.')
