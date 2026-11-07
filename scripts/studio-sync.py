#!/usr/bin/env python3
"""Synchronize a Backroom checkout to one exact commit on backroom-dev."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import shlex
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]
HOST = 'backroom-dev'
PRESERVE = {'.secrets', '.switch-runtime', 'workspaces', '.handoff-contracts', '.git'}


def run(args, *, cwd=None, input=None, capture=True):
    return subprocess.run(args, cwd=cwd, input=input,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None, check=True)


def tree(commit):
    raw = run(['git', 'ls-tree', '-r', '-z', '--full-tree', commit], cwd=ROOT).stdout
    entries = {}
    for record in raw.decode().split('\0'):
        if not record:
            continue
        metadata, name = record.split('\t', 1)
        mode, kind, oid = metadata.split()
        path = PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts or path.parts[0] in PRESERVE or 'node_modules' in path.parts:
            continue
        if kind != 'blob' or mode not in {'100644', '100755'}:
            raise ValueError('Commit contains a non-regular tracked file')
        entries[name] = (oid, mode)
    return entries


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def dry_run(commit, entries):
    print(f'commit {commit}')
    for name in sorted(entries):
        print(f'update {name}')
    print('remove stale tracked files outside .secrets, .switch-runtime, workspaces')
    print('restore group read access on studio-kit/video/node_modules')
    print('validate archive and destination before stopping studio, controllers, identity and provision')
    print('remove only files in the previous root-owned managed-source manifest')
    print('write sync-incomplete boot barrier; install and verify root broker and SSH adapter copies')
    print('verify complete source before clearing the barrier and starting services')


def sync(commit, dry=False):
    resolved = run(['git', 'rev-parse', '--verify', commit + '^{commit}'], cwd=ROOT).stdout.decode().strip()
    entries = tree(resolved)
    if dry:
        dry_run(resolved, entries)
        return
    archive = run(['git', 'archive', '--format=tar', resolved, '--', *(':(literal)' + name for name in entries)], cwd=ROOT).stdout
    manifest = json.dumps({name: {'sha256': sha256(run(['git', 'show', f'{resolved}:{name}'], cwd=ROOT).stdout),
                                 'mode': mode} for name, (_, mode) in entries.items()})
    remote_script = (ROOT / 'scripts/studio-sync-apply.py').read_text()
    command = 'python3 -c ' + shlex.quote(remote_script) + ' ' + shlex.quote(manifest)
    # The fixed remote program validates/stages first, stops all source consumers,
    # replaces only managed files, verifies, then starts the complete source tree.
    result = run(['ssh', '-o', 'BatchMode=yes', HOST, command], input=archive, capture=True)
    print(result.stdout.decode().strip())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('commit')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    try:
        sync(args.commit, args.dry_run)
    except Exception:
        print('studio-sync failed; details withheld', file=sys.stderr)
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
