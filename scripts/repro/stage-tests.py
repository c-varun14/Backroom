"""Copy only account-free test inputs. Never traverse git, credentials or runtime state."""
import os,shutil,sys
from pathlib import Path
source,dest=map(lambda s:Path(s).resolve(),sys.argv[1:3])
roots=['desk/src','desk/tests','harness','receipt','tests/adversarial','deploy','rehearsal/bakery','sample-projects/old-shop','sample-client/adversarial','switch','scripts/repro']
excluded={'.git','.secrets','.runtime','.state','.demo','node_modules','__pycache__','artifacts','.cache','.venv','data'}
for name in roots:
 root=source/name
 if not root.is_dir():raise SystemExit('Missing source directory: '+name+'; nested repositories must be shipped as regular source files, not empty gitlinks.')
 for base,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=[d for d in dirs if d not in excluded and not (Path(base)/d).is_symlink()]
  for filename in files:
   path=Path(base)/filename;rel=path.relative_to(root)
   if path.is_symlink():continue
   if path.suffix not in {'.ts','.js','.json','.yaml','.sh','.py','.md','.nix'} and path.relative_to(source).as_posix() != 'rehearsal/bakery/morrowcrumb-logo.png':continue
   target=dest/name/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,target)

# Read-only bot diagnostics are tested offline with injected HTTP responses.
for name in ['scripts/discord_status.py','scripts/new_project.py','scripts/studio_move.py','scripts/studio-move.sh','scripts/studio_supervise.py','scripts/studio-supervise.sh','scripts/run-door.sh','scripts/run-desk.sh','scripts/studio-verify.py','scripts/studio-ssh.py','scripts/studio-install-tools.sh','scripts/studio-switch-watch.sh','studio-kit/stacks/better-t-stack.json','studio-kit/stacks/bun-sqlite.json']:
 target=dest/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,target)
