import sys,json,time
from pathlib import Path
p=Path('demo/out/timing.json')
x=json.loads(p.read_text()) if p.exists() else {}
command,name=sys.argv[1:3]
now=time.time()
if command=='start': x[name]={'started':now}
else:
 x[name]['ended']=now;x[name]['seconds']=round(now-x[name]['started'],2)
p.write_text(json.dumps(x,indent=2))
print(name,command,time.strftime('%Y-%m-%dT%H:%M:%S%z'),x[name].get('seconds',''))
