import json
import subprocess
import time
from common import *
from manage import bootstrap,create_agent,package
from block1_runtime import pid_is_ours


def start(name,args,marker):
    file=ROOT/f'.switch-runtime/block2-{name}.pid'
    if pid_is_ours(file,marker):print('Rehearsal '+name+' already running');return
    p=subprocess.Popen(args,cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    file.write_text(str(p.pid));print('Rehearsal '+name+' launched; raw output disabled')


def main():
    bootstrap()
    start('controller',['node',str(ROOT/'.switch-runtime/controller/package/cli.mjs'),'run','--data-dir',str(ROOT/'.secrets/block2-controller')],'block2-controller')
    for role in ('lead','builder','reviewer'):create_agent(role);print('Isolated '+role+' configured')
    package()
    start('desk',['bun',str(ROOT/'scripts/block2/runtime.ts')],'scripts/block2/runtime.ts')
    time.sleep(3)
    h=json.loads((ROOT/'.switch-runtime/block2-health.json').read_text())
    print('Rehearsal room connections:',h['connectedRooms']);print('Rehearsal operation errors:',h['errors'])
    print('Stage 1 running services were not restarted, reconfigured, or posted to.')


if __name__=='__main__':safe_main(main)
