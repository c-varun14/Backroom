"""One local start/status command. Native process output is discarded, not dumped."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from block1_setup import ROOT, BASE, PUBLIC, bootstrap, configure_lead, owner_session, lead_session, call, SetupError

os.umask(0o077)


def pid_is_ours(file, marker):
    try:
        pid = int(file.read_text())
        command = Path(f'/proc/{pid}/cmdline').read_bytes()
        return marker.encode() in command
    except (OSError,ValueError):
        return False


def start(name,args,marker):
    file=ROOT / f'.switch-runtime/block1-{name}.pid'
    if pid_is_ours(file,marker):
        print(name+': already running')
        return
    # Never persist or print raw controller/provider output, even on failure.
    process=subprocess.Popen(args,cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    file.write_text(str(process.pid))
    print(name+': launched (raw output disabled)')


def status():
    admin,_=owner_session()
    config=json.loads(PUBLIC.read_text())
    bridges=call(admin,'GET','/gateway/collaborations')
    bridge=next(b for b in bridges if b['bridge_id']==config['bridgeId'])
    print('Switch API: healthy; server 0.31.0')
    print('Discord bridge: '+bridge['status'])
    for field,name in [('clientRoomId','client-morrowcrumb'),('studioRoomId','studio-morrowcrumb')]:
        room=call(admin,'GET','/gateway/rooms/'+config[field])
        print('#'+name+': '+str(room['channel_type'])+'; agents='+str(room['agent_count']))
    lead=lead_session()
    machine=next(m for m in call(lead,'GET','/gateway/management/controllers') if m['id']==config['controllerId'])
    print('Lead controller: '+machine['state'])
    agents=call(lead,'GET','/gateway/management/agents')
    agent=next((a for a in agents if a['name']=='lead'),None)
    if agent:
        s=agent.get('status') or {}
        print('lead: '+s.get('process','pending')+'; attached='+str(s.get('attached',False)).lower()+'; separate non-admin owner')
    h=ROOT / '.switch-runtime/desk-health.json'
    if h.exists():
        health=json.loads(h.read_text())
        pidfile=ROOT/'.switch-runtime/block1-desk.pid'
        fresh=time.time()-h.stat().st_mtime < 10 and pidfile.exists() and str(health['pid'])==pidfile.read_text().strip()
        print('desk: '+('online' if fresh and health['connectedRooms']==2 else 'not ready')+'; room connections='+str(health['connectedRooms'])+'; operation errors='+str(health['errors']))
        print('Stage 1: ticket='+str(health['ticket'])+'; state='+str(health['ticketStatus'])+'; brief version='+str(health['briefVersion']))
        if health.get('draftCode'):print('Current frozen draft code: '+health['draftCode'])
    users=call(admin,'GET',f'/gateway/collaborations/{config["bridgeId"]}/users')
    linked=any(any(c['user_id']==config['ownerId'] for c in u['claimed_by']) for u in users)
    print('Varun Discord account: '+('linked (identity test still needs a real message)' if linked else 'not linked — follow reports/try-it.md'))


def up():
    command=['docker','compose','-p','backroom-block0','--env-file','.secrets/switch.env','-f','.switch-runtime/compose.yml','--profile','gateway','up','-d','--quiet-pull']
    result=subprocess.run(command,cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print('Local server start: exit '+str(result.returncode)+' (raw output suppressed)')
    if result.returncode:raise SetupError('Server start failed')
    bootstrap()
    start('controller',['node',str(ROOT/'.switch-runtime/controller/package/cli.mjs'),'run','--data-dir',str(ROOT/'.secrets/block1-lead-controller')],'block1-lead-controller')
    configure_lead()
    start('desk',['bun',str(ROOT/'desk/src/main.ts')],'desk/src/main.ts')
    time.sleep(3)
    status()


if __name__=='__main__':
    try:
        up() if len(sys.argv)<2 or sys.argv[1]=='up' else status()
    except SetupError as error:
        print(str(error));sys.exit(1)
    except Exception:
        print('Stage 1 command failed; raw exception/response withheld to protect credentials.');sys.exit(1)
