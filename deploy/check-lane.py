from pathlib import Path
import re
pattern=re.compile(r'\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b')
files=[];hits=[]
for root in map(Path,['deploy']):
 for p in root.rglob('*'):
  if not p.is_file() or any(s in {'.runtime','.state','.demo','.secrets','.git','data','node_modules'} for s in p.parts) or p.suffix in {'.png','.jpg'}:continue
  try:text=p.read_text()
  except UnicodeDecodeError:continue
  files.append(p)
  if pattern.search(text):hits.append(str(p))
print(f'Public text files scanned: {len(files)}')
print(f'High-confidence token-pattern matches: {len(hits)}')
if hits:print('Affected filenames only:',hits);raise SystemExit(1)
