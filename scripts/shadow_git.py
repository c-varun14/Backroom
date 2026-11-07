#!/usr/bin/env python3
"""Privileged Git boundary. Never ask Git to open workspace metadata.

Linux dirfds pin each untrusted directory; O_NOFOLLOW rejects symlink swaps.
Only verified object bytes, direct ordinary refs and a validated HEAD cross.
"""
import contextlib
import fcntl
import hashlib
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys

SHA = re.compile(r'[0-9a-f]{40}\Z')
REF = re.compile(r'refs/(?:heads|tags|remotes)/[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9_-]+)*\Z')
DIR = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW


def env():
    # No inherited GIT_DIR, config injection, alternate object dirs or SSH command.
    result = {k: os.environ[k] for k in ('PATH', 'HOME', 'LANG', 'GH_CONFIG_DIR') if k in os.environ}
    result.update(GIT_NO_REPLACE_OBJECTS='1', GIT_CONFIG_NOSYSTEM='1',
                  GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0', GH_PROMPT_DISABLED='1')
    return result


def directory(path):
    fd = os.open('/', DIR)
    try:
        for part in Path(os.path.abspath(path)).parts[1:]:
            next_fd = os.open(part, DIR, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd
    except BaseException:
        os.close(fd)
        raise


def file_bytes(fd, name, limit=1024 * 1024 * 1024):
    handle = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=fd)
    try:
        info = os.fstat(handle)
        if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
            raise ValueError('Not a bounded plain file')
        with os.fdopen(handle, 'rb', closefd=False) as stream:
            data = stream.read(limit + 1)
        if len(data) > limit:
            raise ValueError('File too large')
        return data
    finally:
        os.close(handle)


def ordinary_ref(name):
    return bool(REF.fullmatch(name)) and all(p and p not in ('.', '..') and not p.endswith('.lock') for p in name.split('/')) and '..' not in name


def put(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temporary = path.with_name(path.name + '.incoming')
    with temporary.open('wb') as out:
        out.write(data)
    temporary.chmod(0o600)
    temporary.replace(path)


def git_args(shadow, workspace, args):
    return ['git', '--git-dir=' + str(shadow), '--work-tree=' + str(workspace),
            '-c', 'core.hooksPath=/dev/null', '-c', 'core.bare=false',
            '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', *args]


def checked(shadow, workspace, args):
    result = subprocess.run(git_args(shadow, workspace, args), env=env(), cwd=shadow,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode:
        raise ValueError('Shadow Git verification failed')
    return result.stdout


def import_workspace(workspace, shadow):
    refs = {}
    try:
        source = directory(workspace / '.git')
    except FileNotFoundError:
        return False
    try:
        # Never inspect config, hooks, info/grafts, shallow, alternates or index.
        try:
            objects = os.open('objects', DIR, dir_fd=source)
        except FileNotFoundError:
            objects = None
        if objects is not None:
            try:
                for prefix in os.listdir(objects):
                    if not re.fullmatch(r'[a-f0-9]{2}|pack', prefix):
                        continue
                    sub = os.open(prefix, DIR, dir_fd=objects)
                    try:
                        for name in os.listdir(sub):
                            pattern = r'pack-[a-f0-9]{40}\.(?:pack|idx)' if prefix == 'pack' else r'[a-f0-9]{38}'
                            if re.fullmatch(pattern, name):
                                put(shadow / 'objects' / prefix / name, file_bytes(sub, name))
                    finally:
                        os.close(sub)
            finally:
                os.close(objects)
        try:
            for line in file_bytes(source, 'packed-refs', 8 * 1024 * 1024).decode('ascii').splitlines():
                if not line or line.startswith(('#', '^')):
                    continue
                sha, name = line.split(' ', 1)
                if ordinary_ref(name):
                    if not SHA.fullmatch(sha): raise ValueError('Invalid packed ref')
                    refs[name] = sha
        except FileNotFoundError:
            pass
        def visit(fd, prefix):
            for name in os.listdir(fd):
                ref = prefix + '/' + name
                info = os.stat(name, dir_fd=fd, follow_symlinks=False)
                if stat.S_ISDIR(info.st_mode):
                    child = os.open(name, DIR, dir_fd=fd)
                    try: visit(child, ref)
                    finally: os.close(child)
                elif ordinary_ref(ref):
                    sha = file_bytes(fd, name, 128).decode('ascii').strip()
                    if not SHA.fullmatch(sha): raise ValueError('Indirect refs refused')
                    refs[ref] = sha
        for kind in ('heads', 'tags', 'remotes'):
            # Open refs and kind independently, never follow an intermediate link.
            try:
                parent = os.open('refs', DIR, dir_fd=source)
                try: child = os.open(kind, DIR, dir_fd=parent)
                finally: os.close(parent)
            except FileNotFoundError:
                continue
            try: visit(child, 'refs/' + kind)
            finally: os.close(child)
        head = file_bytes(source, 'HEAD', 256).decode('ascii').strip()
        if not SHA.fullmatch(head) and not (head.startswith('ref: ') and ordinary_ref(head[5:])):
            raise ValueError('Invalid HEAD')
        # fsck verifies object hashes/pack indexes and all reachable refs before use.
        for name, sha in refs.items(): put(shadow / name, (sha + '\n').encode())
        put(shadow / 'HEAD', (head + '\n').encode())
        checked(shadow, workspace, ['fsck', '--full', '--strict', '--no-reflogs'])
        return True
    finally:
        os.close(source)


@contextlib.contextmanager
def repository(workspace):
    workspace = Path(os.path.abspath(workspace))
    # The parent is the trusted user's private home, never a workspace-derived path.
    root = Path.home() / '.backroom-git'
    root.mkdir(mode=0o700, exist_ok=True)
    info = root.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError('Shadow root must be private')
    shadow = root / (hashlib.sha256(str(workspace).encode()).hexdigest() + '.git')
    shadow.mkdir(mode=0o700, exist_ok=True)
    with (shadow / 'boundary.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if not (shadow / 'config').exists():
            subprocess.run(['git', 'init', '--bare', '--template=', str(shadow)], env=env(),
                           cwd=root, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        imported = import_workspace(workspace, shadow)
        # Rebuild our index from the real commit, never copy an agent's index.
        if imported:
            try:
                checked(shadow, workspace, ['read-tree', 'HEAD'])
            except ValueError:
                checked(shadow, workspace, ['read-tree', '--empty'])
        yield shadow, workspace


def main():
    with repository(sys.argv[1]) as (shadow, workspace):
        args = sys.argv[2:]
        if args[:1] == ['--github']:
            github_env = env()
            github_env['GIT_DIR'] = str(shadow)
            return subprocess.run(['gh', *args[1:]], env=github_env, cwd=shadow).returncode
        if args == ['--export-initial']:
            # mkdir relative to a pinned workspace; no existing metadata is ever
            # overwritten. All Git has already run against the protected shadow.
            fd = directory(workspace)
            try:
                os.mkdir('.git', 0o770, dir_fd=fd)
                target = os.open('.git', DIR, dir_fd=fd)
                try:
                    shutil.copytree(shadow, '/proc/self/fd/' + str(target), dirs_exist_ok=True,
                                    ignore=shutil.ignore_patterns('boundary.lock', '*.incoming'))
                    # Plain exported files are agent metadata from this point on.
                    for base, dirs, files in os.walk('/proc/self/fd/' + str(target)):
                        os.chmod(base, 0o2770)
                        for name in files: os.chmod(os.path.join(base, name), 0o660)
                finally: os.close(target)
            finally: os.close(fd)
            return 0
        # Setup uses init in the protected directory too. No external template.
        if args and args[0] == 'init': args += ['--template=']
        result = subprocess.run(git_args(shadow, workspace, args), env=env(), cwd=shadow)
        return result.returncode


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        print('Protected Git operation refused; diagnostics withheld', file=sys.stderr)
        raise SystemExit(1) from None
