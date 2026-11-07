"""Stop this rehearsal at the user's exact quota thresholds; no inference."""
import os
import subprocess
import time
from common import *
from stop import main as stop_rehearsal

def main():
    (ROOT/'.switch-runtime/block2-quota-watch.pid').write_text(str(os.getpid()))
    while True:
        try:
            r=subprocess.run(['python3',str(ROOT/'spikes/desk/codex_usage.py')],capture_output=True,text=True,timeout=25,cwd=ROOT)
            primary=re.search(r'codex primary remaining_percent=\s*(\d+)',r.stdout)
            weekly=re.search(r'codex secondary remaining_percent=\s*(\d+)',r.stdout)
            if r.returncode or not primary or not weekly:raise SetupError('Quota probe unavailable')
            state={'primary':int(primary[1]),'weekly':int(weekly[1]),'stopped':False}
            (ROOT/'.switch-runtime/block2-quota-watch.json').write_text(json.dumps(state))
            if state['primary']==0 or state['weekly']<=20:
                stop_rehearsal();state['stopped']=True
                (ROOT/'.switch-runtime/block2-quota-watch.json').write_text(json.dumps(state))
                h=json.loads((ROOT/'.switch-runtime/block2-health.json').read_text())
                with (ROOT/'reports/block-2.md').open('a') as file:
                    file.write('\n## Quota stop — current resume position\n\n')
                    file.write(f'Automatic rehearsal-only watcher: primary {state["primary"]}%, weekly {state["weekly"]}%. Required threshold reached; no model fallback. Rehearsal agents/controller/desk stopped; real services and local deployed app untouched.\n\n')
                    file.write('Persisted stage: '+h['workflow']['stage']+'; candidate '+str(h.get('candidate'))+'; review '+str(h.get('reviewVerdict'))+'; deployed '+str((h.get('deployResult') or {}).get('status'))+'.\n')
                    file.write('Resume only after allowance recovery. Inspect current public health/state and interrupted workspace before restarting. Do not use real-room restart scripts.\n')
                return
        except Exception:
            # Never print exception/CLI content or infer unused quota.
            pass
        time.sleep(30)

if __name__=='__main__':safe_main(main)
