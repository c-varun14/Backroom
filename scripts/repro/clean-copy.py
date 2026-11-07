#!/usr/bin/env python3
"""Export product working-tree files; refuse nested repositories.
--public normalizes machine paths in the COPY only; original evidence is untouched.
"""
import argparse,hashlib,json,os,re,shutil,subprocess,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
EXCLUDED={'.git','.secrets','.switch-runtime','.runtime','.state','.demo','.venv','.cache','node_modules','__pycache__','workspaces','artifacts','reports','specs','spikes'}
# Build the expression without embedding a particular user's machine path.
PRIVATE=re.compile(r'/(?:[h]ome|Users)/[A-Za-z0-9_.-]+(?:/[^\s\x00<>"\'`),;\\]*)?')
def listed(repo):
 result=subprocess.run(['git','-C',str(repo),'ls-files','--cached','--others','--exclude-standard','-z'],check=True,stdout=subprocess.PIPE)
 return [os.fsdecode(x) for x in result.stdout.split(b'\0') if x]
def selected(source):
 paths=set()
 def add(repo,prefix):
  for name in listed(repo):
   rel=Path(prefix)/name
   if rel.suffix.lower() in {'.png','.jpg','.jpeg','.gif','.mp4','.webm','.wav'} and rel.as_posix() != 'docs/media/keys-page.png':continue
   if any(x in EXCLUDED for x in rel.parts) or rel.name in {'auth.json','.credentials.json'} or rel.name=='.env' or rel.name.endswith('.env') or re.search(r'\.(?:sqlite3?|db)(?:-(?:wal|shm))?$',rel.name):continue
   path=source/rel
   if path.is_symlink():raise ValueError('Symlink must be reviewed before publication: '+rel.as_posix())
   if path.is_file():paths.add(rel)
   elif path.is_dir() and (path/'.git').exists():raise ValueError('Unexpected nested repository: '+rel.as_posix())
 add(source,'')
 return sorted(paths)
def normalize(text,source):
 changed=text
 # Path constructor rewrites preserve Python behavior in legacy helpers.
 path_re=re.compile(r"Path\((['\"])(/(?:[h]ome|Users)/[^/'\"]+)(/[^'\"]*)?\1\)")
 changed=path_re.sub(lambda m:'(Path.home() / '+repr((m[3] or '').lstrip('/'))+')',changed)
 # One legacy JavaScript helper reads its own CLI login; keep the path portable.
 js=re.compile(r"readFileSync\((['\"])/(?:[h]ome|Users)/[^/'\"]+(/[^'\"]+)\1")
 changed=js.sub(lambda m:"readFileSync(process.env.HOME + "+repr(m[2]),changed)
 changed=changed.replace(str(source),'${BACKROOM_ROOT}')
 # Historical text/source-report strings: redact the user prefix, not the result.
 changed=re.sub(r'/(?:[h]ome|Users)/[A-Za-z0-9_.-]+','${HOME}',changed)
 return changed

def export(source,destination,public=False):
 if destination==source or source in destination.parents:raise ValueError('Copy destination must be outside the source tree')
 if destination.exists() and any(destination.iterdir()):raise ValueError('Copy destination must be empty')
 destination.mkdir(parents=True,exist_ok=True)
 files=selected(source);changes=[]
 for rel in files:
  original=source/rel;target=destination/rel;target.parent.mkdir(parents=True,exist_ok=True)
  data=original.read_bytes();output=data
  if public:
   try:text=data.decode('utf8')
   except UnicodeDecodeError:pass
   else:
    updated=normalize(text,source)
    if PRIVATE.search(updated):raise ValueError('Unnormalized machine path: '+rel.as_posix())
    output=updated.encode('utf8')
  target.write_bytes(output);target.chmod(original.stat().st_mode & 0o777)
  if data!=output:changes.append({'path':rel.as_posix(),'sourceSha256':hashlib.sha256(data).hexdigest(),'publishedSha256':hashlib.sha256(output).hexdigest()})
 manifest={'mode':'public-normalized' if public else 'exact-working-tree','files':len(files),'nestedSources':[],'privateRuntimeIncluded':False,'pathNormalizations':changes,'note':'Path-normalized evidence preserves reported actions/outcomes; command path spellings differ from local originals. No Git metadata, credentials, model caches or generated ignored media included.'}
 (destination/'PUBLICATION.json').write_text(json.dumps(manifest,indent=2)+'\n')
 return manifest
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--output',type=Path);p.add_argument('--public',action='store_true');args=p.parse_args()
 dest=(args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix='backroom-clean-')))
 m=export(ROOT,dest,args.public)
 print('Clean copy:',dest)
 print('Selected source files:',m['files'])
 print('Nested repositories: none; product source only')
 print('Path-normalized files:',len(m['pathNormalizations']))
 print('Private runtime/account files: excluded')
