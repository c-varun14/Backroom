"""Check a staged publication tree without running its service code."""
import ast,json,re,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
private=re.compile(r'/(?:[h]ome|Users)/[A-Za-z0-9_.-]+')
forbidden={'.git','.secrets','.switch-runtime','node_modules','.venv','.cache','.runtime','.demo'}
checked=0;python=0;documents=0
for p in root.rglob('*'):
 if any(x in forbidden for x in p.relative_to(root).parts):raise SystemExit('Forbidden runtime/Git entry: '+str(p.relative_to(root)))
 if not p.is_file():continue
 try:text=p.read_text()
 except UnicodeDecodeError:continue
 checked+=1
 if private.search(text):raise SystemExit('Private machine path remains: '+str(p.relative_to(root)))
 if p.suffix=='.py':ast.parse(text,filename=str(p.relative_to(root)));python+=1
 if p.suffix=='.json':json.loads(text);documents+=1
for relative in ['rehearsal/bakery/app.ts','rehearsal/bakery/app.test.ts','rehearsal/bakery/demo.ts','sample-projects/old-shop/server.js','sample-projects/old-shop/server.test.js']:
 if not (root/relative).is_file():raise SystemExit('Missing nested input: '+relative)
# README navigation must be local/public; media/workspace links belong to historical reports only.
missing=[]
for target in re.findall(r'\]\(([^)]+)\)',(root/'README.md').read_text()):
 if '://' in target or target.startswith('#'):continue
 if not (root/target.split('#')[0]).exists():missing.append(target)
if missing:raise SystemExit('Broken README links: '+', '.join(missing))
print(f'Publication audit: {checked} text files; {python} Python files parsed; {documents} JSON files parsed; private machine paths=0.')
print('Runtime/account/cache/Git metadata absent; nested test sources present; README local links resolve.')
