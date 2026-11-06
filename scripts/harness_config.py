"""Read the same validated YAML as the command adapter; never reads credentials."""
import json
import os
from pathlib import Path
import subprocess
import shutil
ROOT = Path(__file__).resolve().parents[1]

def role_config(role):
    path = os.environ.get('BACKROOM_HARNESS_CONFIG', str(ROOT / 'backroom.yaml'))
    result = subprocess.run(['bun', '--no-env-file', str(ROOT / 'harness/config.ts'), path, role], capture_output=True, text=True)
    if result.returncode:
        raise ValueError('Invalid harness configuration; raw output withheld')
    return json.loads(result.stdout)

def definition(role):
    c = role_config(role)
    return {'provider':c['harness'], **({'model':c['model']} if c.get('model') else {}), **({'command':c['argv']} if c['harness']=='command' else {})}

def provider_ready(machine, role):
    c = role_config(role)
    if c['harness']=='command':
        return shutil.which(c['argv'][0]) is not None
    return any(p.get('provider') == c['harness'] and p.get('installed') and (c['harness']=='command' or p.get('auth')=='ok')
               for p in (machine.get('status') or {}).get('providers', []))

def command_role(c, role, name, directory, desired='running'):
    """Plain protocol identity, never a fictitious managed provider."""
    from block1_setup import call, lead_session, owner_session, BASE
    import requests
    import re
    if not re.fullmatch(r'[a-z0-9-]+', name):
        raise ValueError('Invalid command role name')
    session = lead_session()
    admin, _ = owner_session()
    state = ROOT / '.secrets' / ('command-' + c['projectId'] + '-' + name)
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    identity = state / 'identity.json'
    if identity.exists():
        agent = json.loads(identity.read_text())
    else:
        registration = call(session, 'POST', '/gateway/api-keys', {'label':'Configured command '+name})
        response = requests.post(BASE+'/agents', headers={'Authorization':'Bearer '+registration['key']}, json={
            'name':name,'description':'Configured plain CLI adapter','connector_type':'backroom-command',
            'integration_profile':{'connection_model':'always_on','message_exchange':True,'pre_invocation_mediation':[], 'post_invocation_mediation':[], 'event_reporting':[]}}, timeout=30)
        if not response.ok:
            raise ValueError('Command registration failed; response withheld')
        agent = response.json()
        identity.write_text(json.dumps(agent)); identity.chmod(0o600)
        (state/'key').write_text(agent['api_key']); (state/'key').chmod(0o600)
    call(session,'PUT',f'/gateway/agents/{agent["id"]}/addressing-policy',{'policy':None})
    call(admin,'POST',f'/gateway/rooms/{c["workRoomId"]}/agents',{'agent_ids':[agent['id']]})
    config = {'base':BASE,'agentId':agent['id'],'name':name,'roomId':c['workRoomId'],'keyFile':str(state/'key'),
              'command':role_config(role)['argv'],'cwd':str(directory),'journalFile':str(state/'journal.json')}
    Path(directory).mkdir(parents=True,exist_ok=True)
    (state/'config.json').write_text(json.dumps(config))
    from block1_runtime import pid_is_ours
    pidfile=state/'agent.pid'
    if desired=='running' and not pid_is_ours(pidfile,str(state/'config.json')):
        p=subprocess.Popen(['bun','--no-env-file',str(ROOT/'harness/command-agent.ts'),str(state/'config.json')],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        pidfile.write_text(str(p.pid))
    return {'id':agent['id'],'name':name}
