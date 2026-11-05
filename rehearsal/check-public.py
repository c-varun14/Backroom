from pathlib import Path
import re,subprocess
roots=[Path('studio-kit/agents'),Path('rehearsal'),Path('tests/adversarial')]
exclude={'.git','.runtime','.secrets','node_modules','data'}
credential=Path('rehearsal/.secrets/owner-password').read_text().strip()
files=[];matches=[]
pattern=re.compile(r'\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b')
for root in roots:
 for p in root.rglob('*'):
  if not p.is_file() or any(v in exclude for v in p.parts) or p.suffix in {'.png','.sqlite'}:continue
  try:s=p.read_text()
  except UnicodeDecodeError:continue
  files.append(p)
  if credential in s or pattern.search(s):matches.append(str(p))
print(f'Lane public text files checked: {len(files)}')
print(f'Known local credential / high-confidence token matches: {len(matches)}')
if matches:print('Affected filenames only:',matches);raise SystemExit(1)
status=subprocess.check_output(['git','-C','rehearsal/bakery','status','--porcelain'],text=True)
count=subprocess.check_output(['git','-C','rehearsal/bakery','rev-list','--count','HEAD'],text=True).strip()
print('Bakery working tree: '+('clean' if not status else 'DIRTY'))
print('Reachable bakery commits: '+count)
if status or count!='2':raise SystemExit(1)
