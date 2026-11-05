"""Stop only this rehearsal; never touch Stage 1 or shared Switch containers."""
import os
import signal
import time
from common import *
from block1_runtime import pid_is_ours

def main():
    driver=ROOT/'.switch-runtime/block2-drive.pid'
    if pid_is_ours(driver,'scripts/block2/drive.py'):
        pid=int(driver.read_text());os.kill(pid,signal.SIGTERM)
    c=json.loads(PUBLIC.read_text());s,_=login('agents')
    for a in call(s,'GET','/gateway/management/agents'):
        if a.get('controller_id')==c['controllerId']:
            call(s,'PATCH','/gateway/management/agents/'+a['agent_id'],{'desired_state':'stopped'})
            print('Stopped rehearsal agent:',a['name'])
    for name,marker in [('desk','scripts/block2/runtime.ts'),('controller','block2-controller')]:
        file=ROOT/f'.switch-runtime/block2-{name}.pid'
        if pid_is_ours(file,marker):
            pid=int(file.read_text());os.killpg(os.getpgid(pid),signal.SIGTERM)
    time.sleep(2)
    for name,marker in [('desk','scripts/block2/runtime.ts'),('controller','block2-controller')]:
        print('Rehearsal '+name+' running:',pid_is_ours(ROOT/f'.switch-runtime/block2-{name}.pid',marker))

if __name__=='__main__':safe_main(main)
