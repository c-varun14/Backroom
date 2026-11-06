"""Read the Git publication surface; emit file/line/kind ONLY, never matched values."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
ROOT=Path(__file__).resolve().parents[2]
PRIVATE_TERMS=json.loads((ROOT/'.switch-runtime/security-private-terms.json').read_text()) if (ROOT/'.switch-runtime/security-private-terms.json').exists() else []
PRIVATE_EMAIL_DOMAINS={'anthropic.com'} # Required co-author attribution, not an account credential.
RULES=[
 ('private-key',re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----')),
 ('provider-token',re.compile(r'\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|xox[baprs]-[A-Za-z0-9-]{12,}|(?:swk_|swlr_|swac_)[A-Za-z0-9_-]{16,})\b')),
 ('jwt-or-discord-token',re.compile(r'\b(?:eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|mfa\.[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{23,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{25,})\b')),
 ('authorization-value',re.compile(r'\b(?:Bearer|Basic)\s+([A-Za-z0-9_./+=-]{8,})')) ,
 ('cloud-access-key',re.compile(r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b')),
 ('discord-or-platform-snowflake',re.compile(r'(?<![A-Za-z0-9])\d{17,20}(?![A-Za-z0-9])')),
 ('personal-absolute-path',re.compile(r'(?:/home/[A-Za-z0-9_.-]+|/Users/[A-Za-z0-9_.-]+)(?:/[^\s"<>]*)?')),
 ('private-agency-reference',re.compile(r'(?:~/agency(?:/[^\s"`<>]*)?|/agency/(?:agency-wiki|clients)(?:/[^\s"`<>]*)?)')),
 ('email',re.compile(r'(?<![\w.+-])[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?![\w.-])')),
 ('credential-assignment',re.compile(r'''(?ix)["']?\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?(?:token|key)|enrollment[_-]?code|client[_-]?secret|password|passwd|authorization|cookie|token|secret|[A-Za-z_]*(?:token|secret|cookie|password|api_key)[A-Za-z_]*)["']?\s*[:=]\s*(?:"([^"\n]*)"|'([^'\n]*)'|([^\s,;<>}\]]+))''')),
 ('capability-url',re.compile(r'https?://[^\s"<>]+[?&](?:access_token|api_key|token|signature|password|secret)=[^\s"<>]+',re.I)),
]
UUID=re.compile(r'(?<![A-Za-z0-9])[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?![A-Za-z0-9])',re.I)
def dummy(value):
 return bool(re.search(r'(?i)REDACTED|PLACEHOLDER|SAMPLE|FICTIONAL|EXAMPLE|your[-_ ]|<[^>]+>|\[.*\]|\{.*\}',value))
def credential(match):
 value=next((x for x in match.groups() if x is not None),'').strip()
 if dummy(value) or len(value)<12:return False
 if any(c in value for c in '()[]{}') or value.startswith(('process.','os.','secrets.','private_field','env_field')):return False
 return bool(re.fullmatch(r'[a-f0-9-]{32,}',value,re.I) or (len(value)>=20 and re.search('[a-zA-Z]',value) and re.search('[0-9]',value)))
def scan(name,data,view='worktree'):
 findings=[]
 if b'\0' in data[:8192]:return [{'file':name,'line':0,'kind':'binary-or-generated-file','view':view}]
 try:text=data.decode('utf8')
 except UnicodeDecodeError:return [{'file':name,'line':0,'kind':'binary-or-generated-file','view':view}]
 for number,line in enumerate(text.splitlines(),1):
  for kind,pattern in RULES:
   matches=list(pattern.finditer(line))
   if not matches:continue
   if kind=='email':
    matches=[m for m in matches if not (m[0].split('@')[1].lower() in PRIVATE_EMAIL_DOMAINS or re.search(r'(?i)(?:^|\.)(?:example\.(?:com|org|net|test|invalid)|[^.]+\.example)$',m[0].split('@')[1]) or m[0].split('@')[1].lower().endswith(('.test','.invalid','.example')))]
   if kind=='authorization-value':matches=[m for m in matches if not dummy(m[1])]
   if kind=='credential-assignment':matches=[m for m in matches if credential(m)]
   if matches:findings.append({'file':name,'line':number,'kind':kind,'view':view})
  if any(re.search(r'(?i)\b'+re.escape(term)+r'\b',line) for term in PRIVATE_TERMS):findings.append({'file':name,'line':number,'kind':'private-project-reference','view':view})
  if UUID.search(line) and name.startswith(('reports/','receipt/','spikes/')) and not re.search(r'SAMPLE|sample-|fixture|00000000-',line):
   findings.append({'file':name,'line':number,'kind':'runtime-uuid-or-identity','view':view})
 return findings

def inventory(base=ROOT,prefix=''):
 raw=subprocess.check_output(['git','-C',str(base),'ls-files','--others','--exclude-standard','--cached','-z'])
 return list(dict.fromkeys(prefix+x.decode() for x in raw.split(b'\0') if x))
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--output',default='.switch-runtime/security-findings.json');args=ap.parse_args()
 names=inventory();findings=[];counts=collections.Counter();nested=[]
 for name in names:
  path=ROOT/name
  if path.is_symlink():findings.append({'file':name,'line':0,'kind':'symlink-not-followed','view':'worktree'});continue
  if path.is_dir():
   findings.append({'file':name,'line':0,'kind':'embedded-repository-gitlink-risk','view':'worktree'})
   if (path/'.git').exists():nested.append(name)
   continue
  if not path.is_file():findings.append({'file':name,'line':0,'kind':'missing-publication-path','view':'worktree'});continue
  if not path.resolve().is_relative_to(ROOT):raise RuntimeError('Outside-root path refused')
  data=path.read_bytes();counts['files']+=1;counts['bytes']+=len(data);findings.extend(scan(name,data))
  if len(data)>250000:findings.append({'file':name,'line':0,'kind':'large-generated-artifact-review','view':'worktree'})
 # The staged blob can differ from the cleaned working copy; ignore rules do not hide it.
 tracked=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).split(b'\0')
 for raw in tracked:
  if not raw:continue
  name=raw.decode();r=subprocess.run(['git','show',':'+name],cwd=ROOT,capture_output=True)
  if r.returncode==0:findings.extend(scan(name,r.stdout,'index'))
 for dirname in nested:
  for name in inventory(ROOT/dirname,dirname):
   path=ROOT/name
   if path.is_file() and not path.is_symlink() and path.resolve().is_relative_to(ROOT):
    counts['nested_files']+=1;findings.extend(scan(name,path.read_bytes(),'embedded-worktree'))
 output=ROOT/args.output;output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps({'counts':dict(counts),'findings':findings},indent=2))
 print('Publication files:',counts['files'],'embedded files:',counts['nested_files'])
 for kind,n in sorted(collections.Counter(x['kind'] for x in findings).items()):print(kind+':',n)
 print('Value-free findings:',args.output)
if __name__=='__main__':main()
