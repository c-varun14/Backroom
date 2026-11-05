"""Restart only the isolated rehearsal desk, never the real desk/controller."""
import os
import signal
import time
from common import *
from block1_runtime import pid_is_ours
from up import start

def main():
    file=ROOT/'.switch-runtime/block2-desk.pid';marker='scripts/block2/runtime.ts'
    if pid_is_ours(file,marker):
        pid=int(file.read_text());os.killpg(os.getpgid(pid),signal.SIGTERM)
        for _ in range(20):
            if not pid_is_ours(file,marker):break
            time.sleep(1)
        else:raise SetupError('Rehearsal desk has not stopped; no overlapping process launched')
    start('desk',['bun',str(ROOT/'scripts/block2/runtime.ts')],marker)
    print('Only rehearsal desk restarted; no agent/controller/Discord mutation.')

if __name__=='__main__':safe_main(main)
