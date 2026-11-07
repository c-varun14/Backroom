#!/usr/bin/env python3
"""Root forced-command broker: exact NixDeployer grammar, execve, no shell."""
import json
import os
from pathlib import Path
import re
import shlex
import stat
import sys

FLEET = Path('/var/lib/backroom/fleet')
BIN = '/run/current-system/sw/bin/'
APP = r'(?!shared(?:[/.]|$))[a-z][a-z0-9-]{0,23}'
SHA = r'[a-f0-9]{40}'
TOKEN = r'[a-f0-9]{64}'
CLOSURE = '/nix/var/nix/profiles/system'


def full(pattern, value):
    return bool(re.fullmatch(pattern, value))


def trusted(path):
    """Every component, executable and imported Nix/Compose tree is root-only."""
    path = Path(path)
    for part in [*reversed(path.parents), path]:
        info = part.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError('Untrusted root input')


def deploy_host():
    trusted(FLEET / 'hosts/settings.json')
    ip = json.loads((FLEET / 'hosts/settings.json').read_text())['deployIp']
    if not full(r'\d{1,3}(?:\.\d{1,3}){3}', ip) or any(int(n)>255 for n in ip.split('.')):
        raise ValueError('Invalid deploy host')
    return 'root@' + ip


def parse(command, host):
    words = shlex.split(command)
    # SSH adapter forwards only these deploy-host reads/checks. It cannot turn
    # root's private key into a general remote command channel.
    prefix = [BIN+'ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '--', host]
    if words[:len(prefix)] == prefix and len(words) == len(prefix)+1:
        remote = shlex.split(words[-1])
        if remote[:1] != ['exec']: raise ValueError('Remote exec required')
        args = remote[1:]
        if args == ['readlink', '-f', CLOSURE] or (len(args)>=3 and args[:2] == ['backroom-env','check'] and full(APP,args[2]) and args[2]!='shared' and len(args)<=131 and all(full(r'[A-Za-z_][A-Za-z0-9_]*',a) for a in args[3:])):
            # Fixed command names and validated tokens only.
            return [BIN+'ssh', '-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','--',host, 'exec '+shlex.join(args)]
        raise ValueError('Remote operation refused')
    expected = ['cd', str(FLEET), '&&', 'exec']
    if words[:4] != expected: raise ValueError('Fixed fleet cwd required')
    a = words[4:]
    ok = False
    if a == ['cat','hosts/settings.json'] or a == ['sha256sum','lib/app-package.nix']:
        ok = True
    elif len(a)==2 and a[0]=='cat' and full('apps/'+APP+r'\.json',a[1]): ok = True
    elif len(a)==3 and a[:2]==['test','-d'] and full('sources/'+APP+'/'+SHA,a[2]): ok = True
    elif len(a)==5 and a[:2]==['python3','scripts/entry.py'] and a[2] in ('begin','write','restore','end') and full(APP,a[3]) and a[3]!='shared' and full(TOKEN,a[4]): ok = True
    elif len(a)==4 and a[:2]==['python3','scripts/unpack-source.py'] and full(APP,a[2]) and a[2]!='shared' and full(SHA,a[3]): ok = True
    elif len(a)==3 and a[:2]==['python3','scripts/ensure-secret.py'] and full(APP,a[2]) and a[2]!='shared': ok = True
    elif a == ['nix','eval','--json','path:'+str(FLEET)+'#buildMetadata']: ok = True
    elif len(a)==5 and a[:4]==['nix','build','--no-link','--no-write-lock-file'] and full(re.escape('path:'+str(FLEET)+'#')+APP,a[4]): ok = True
    elif a in ([ 'nixos-rebuild','build','--flake','path:'+str(FLEET)+'#deploy','--no-write-lock-file'],
                ['nixos-rebuild','switch','--flake','path:'+str(FLEET)+'#deploy','--target-host',host,'--no-write-lock-file'],
                ['nixos-rebuild','switch','--rollback','--no-reexec','--target-host',host]): ok = True
    health = ['curl','--fail','--silent','--show-error','--max-time','5','--retry','10','--retry-all-errors','--retry-connrefused','--retry-delay','1','--proto','=https','--write-out','\n%{http_code}']
    if len(a)==len(health)+1 and a[:-1]==health and full(r'https://[a-z0-9]+(?:[.-][a-z0-9]+)*/(?:health|ready)',a[-1]): ok=True
    if not ok: raise ValueError('Operation refused')
    return [BIN+a[0], *a[1:]]


def main():
    os.umask(0o077)
    host = deploy_host()
    args = parse(os.environ.get('SSH_ORIGINAL_COMMAND',''), host)
    # Refuse even allowlisted operations if studio can change any evaluated code.
    trusted(FLEET)
    for base, dirs, files in os.walk(FLEET, followlinks=False):
        # Git metadata isn't evaluated by Nix or these helpers. Never run Git here.
        dirs[:] = [d for d in dirs if d != '.git']
        for name in dirs + files: trusted(Path(base)/name)
    os.chdir(FLEET)
    os.execve(args[0], args, {'PATH':BIN.rstrip('/'), 'HOME':'/root', 'LANG':'C.UTF-8', 'GIT_NO_REPLACE_OBJECTS':'1'})


if __name__ == '__main__':
    try: main()
    except Exception:
        print('Deployment broker: refused', file=sys.stderr)
        raise SystemExit(1) from None
