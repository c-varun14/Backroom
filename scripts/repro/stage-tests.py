"""Copy only account-free test inputs. Never traverse git, credentials or runtime state."""
import os,shutil,sys
from pathlib import Path
source,dest=map(lambda s:Path(s).resolve(),sys.argv[1:3])
roots=['desk/src','desk/tests','receipt','tests/adversarial','deploy','rehearsal/bakery','sample-projects/old-shop','sample-client/adversarial','switch','scripts/repro']
excluded={'.git','.secrets','.runtime','.state','.demo','node_modules','__pycache__','artifacts','.cache','.venv','data'}
for name in roots:
 root=source/name
 if not root.is_dir():raise SystemExit('Missing source directory: '+name+'; nested repositories must be shipped as regular source files, not empty gitlinks.')
 for base,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=[d for d in dirs if d not in excluded and not (Path(base)/d).is_symlink()]
  for filename in files:
   path=Path(base)/filename;rel=path.relative_to(root)
   if path.is_symlink() or path.suffix not in {'.ts','.js','.json','.yaml','.sh','.py','.md'}:continue
   target=dest/name/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)
