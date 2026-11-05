"""Enroll and run the released headless controller, no Console process."""
import json
import os
import subprocess
from common import ROOT, owner_api, load, save, show

owner, _ = owner_api()
state = load()
r, providers = owner.request('GET', '/gateway/management/providers')
if r.status_code == 200:
    (ROOT / '.switch-runtime/providers.json').write_text(json.dumps(providers, indent=2))
if 'controller_enrolled' not in state:
    r, enrollment = owner.request('POST', '/gateway/management/enrollment-codes', {})
    r.raise_for_status()
    state['controller_enrollment_code'] = enrollment['code']
    save(state)
    args = ['node', str(ROOT / '.switch-runtime/controller/package/cli.mjs'), 'enroll', '--server', 'http://127.0.0.1:8000', '--code', enrollment['code'], '--name', 'backroom-block0-fedora', '--data-dir', str(ROOT / '.secrets/controller'), '--secret-store', 'file']
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    print('Controller enroll command: node .switch-runtime/controller/package/cli.mjs enroll --server http://127.0.0.1:8000 --code <REDACTED> --name backroom-block0-fedora --data-dir .secrets/controller --secret-store file')
    print('Enrollment output:', result.stdout, result.stderr)
    result.check_returncode()
    state['controller_enrolled'] = True
    save(state)
log = ROOT / '.secrets/controller.log'
with log.open('a') as output:
    log.chmod(0o600)
    env = os.environ.copy()
    env['XDG_STATE_HOME'] = str(ROOT / '.secrets/provider-state')
    env['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] = '1'
    for key in ('ANTHROPIC_API_KEY', 'OPENAI_API_KEY'):
        assert not env.get(key), key + ' must remain unset'
    proc = subprocess.Popen(['node', str(ROOT / '.switch-runtime/controller/package/cli.mjs'), 'run', '--data-dir', str(ROOT / '.secrets/controller')], cwd=ROOT, env=env, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
    (ROOT / '.switch-runtime/controller.pid').write_text(str(proc.pid))
    print('Started headless controller PID', proc.pid, '; provider state and raw controller output under .secrets; Console is not running.')
