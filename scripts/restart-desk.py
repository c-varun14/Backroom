"""Restart only this lane's desk process; never print its credential state."""
import os
import signal
import time
from block1_setup import ROOT
from block1_runtime import pid_is_ours,start
file=ROOT/'.switch-runtime/block1-desk.pid'
if pid_is_ours(file,'desk/src/main.ts'):
    os.kill(int(file.read_text()),signal.SIGTERM)
    time.sleep(2)
start('desk',['bun',str(ROOT/'desk/src/main.ts')],'desk/src/main.ts')
