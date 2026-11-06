"""Reserve final cleanup allowance per the operator's final-push instruction."""
import re
import subprocess
import time
from common import *

def main():
    (STATE/'watch.pid').write_text(str(os.getpid()))
    while True:
        p=subprocess.run(['python3',str(ROOT/'spikes/desk/codex_usage.py')],cwd=ROOT,capture_output=True,text=True,timeout=45)
        primary=re.search(r'codex primary remaining_percent=\s*(\d+)',p.stdout)
        weekly=re.search(r'codex secondary remaining_percent=\s*(\d+)',p.stdout)
        if p.returncode==0 and primary and weekly:
            quota={'primary':int(primary[1]),'weekly':int(weekly[1]),'stopped':False}
            (STATE/'quota.json').write_text(json.dumps(quota))
            if quota['primary']==0 or quota['weekly']<=1:
                result=subprocess.run(['python3',str(ROOT/'scripts/dryrun/manage.py'),'stop','--from-watch'],cwd=ROOT,capture_output=True,text=True,timeout=60)
                cleanup=subprocess.run(['bun',str(ROOT/'scripts/dryrun/runtime.ts'),'--cleanup'],cwd=ROOT,capture_output=True,text=True,timeout=60)
                quota.update(deploymentCleanupExit=cleanup.returncode)
                quota.update(stopped=result.returncode==0)
                (STATE/'quota.json').write_text(json.dumps(quota))
                h=json.loads((STATE/'health.json').read_text())
                with (ROOT/'reports/real-dryrun.md').open('a') as f:
                    f.write('\n## Allowance cleanup checkpoint\n\nOperator asked to stop dryrun services before the limit if possible. Cleanup reserve reached: '+str(quota)+'. Stop exit '+str(result.returncode)+'. Persisted stage '+h['workflow']['stage']+', review '+str(h['reviewVerdict'])+', candidate '+str(h['candidate'])+'. No model fallback/reset. Real desk restart and health check remain for the main session; watcher does not touch real services.\n')
                return
        time.sleep(30)

if __name__=='__main__':safe_main(main)
