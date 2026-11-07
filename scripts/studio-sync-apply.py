"""Fixed remote sync program, also exercised against local fictional trees."""
import fcntl
import grp
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import socket
import stat
import subprocess
import sys
import tarfile
import tempfile

PRESERVE = {'.secrets', '.switch-runtime', 'workspaces', '.handoff-contracts', '.git'}
SERVICES = ['backroom-studio', 'backroom-controller-build', 'backroom-controller-lead',
            'backroom-identity', 'backroom-provision']


def source_name(name):
    path = PurePosixPath(name)
    if (not name or path.is_absolute() or str(path) != name or
            any(part in ('', '.', '..', '.git', 'node_modules') for part in path.parts) or
            path.parts[0] in PRESERVE):
        raise ValueError('unsafe source path')
    return path


def manifest(data):
    if not isinstance(data, dict):
        raise ValueError('invalid source manifest')
    for name, meta in data.items():
        source_name(name)
        if (not isinstance(meta, dict) or set(meta) != {'sha256', 'mode'} or
                meta['mode'] not in ('100644', '100755') or
                not isinstance(meta['sha256'], str) or len(meta['sha256']) != 64 or
                any(c not in '0123456789abcdef' for c in meta['sha256'])):
            raise ValueError('invalid source manifest')
    return data


def safe_components(path, directory=False):
    """Validate all existing components before mutation; never follow links."""
    path = Path(path)
    for component in [*reversed(path.parents), path]:
        try:
            info = component.lstat()
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(info.st_mode):
            raise ValueError('destination symlink refused')
        if component != path or directory:
            if not stat.S_ISDIR(info.st_mode):
                raise ValueError('destination directory refused')
        elif not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
            raise ValueError('destination file refused')


def control(action):
    subprocess.run(['systemctl', action, *SERVICES], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def verify(root, expected):
    for name, meta in expected.items():
        file = root / name
        safe_components(file)
        if (not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != meta['sha256'] or
                stat.S_IMODE(file.stat().st_mode) != (0o755 if meta['mode'] == '100755' else 0o644)):
            raise ValueError('source verification failed')


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def install_file(source, destination, mode, owner):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, prefix='.sync-', delete=False) as output:
        temporary = Path(output.name)
        try:
            with source.open('rb') as incoming:
                shutil.copyfileobj(incoming, output)
            output.flush()
            os.fchown(output.fileno(), *owner)
            os.fchmod(output.fileno(), mode)
            os.fsync(output.fileno())
            output.close()
            temporary.replace(destination)
            sync_directory(destination.parent)
        finally:
            temporary.unlink(missing_ok=True)


def installed_files(expected, prefix):
    sources = {'scripts/studio-deploy-broker.py', 'scripts/studio-ssh.py'}
    if not sources.intersection(expected):
        return []  # Unit fixtures can exercise the generic source operation.
    if not sources.issubset(expected):
        raise ValueError('incomplete deployment artifacts')
    return [
        ('scripts/studio-deploy-broker.py', prefix / 'etc/backroom/studio-deploy-broker.py', 0o600),
        ('scripts/studio-ssh.py', prefix / 'etc/backroom/studio-ssh.py', 0o600),
        ('scripts/studio-ssh.py', prefix / 'opt/backroom/studio-bin/ssh', 0o755),
    ]


def verify_installed(entries, expected, owner):
    for source, target, mode in entries:
        safe_components(target)
        info = target.stat()
        if (hashlib.sha256(target.read_bytes()).hexdigest() != expected[source]['sha256'] or
                stat.S_IMODE(info.st_mode) != mode or (info.st_uid, info.st_gid) != owner):
            raise ValueError('installed deployment artifact mismatch')


def atomic_json(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=file.parent, prefix='.sync-', delete=False) as output:
        temporary = Path(output.name)
        try:
            output.write(json.dumps(value, sort_keys=True).encode())
            output.flush()
            os.fsync(output.fileno())
            output.close()
            temporary.chmod(0o600)
            temporary.replace(file)
            sync_directory(file.parent)
        finally:
            temporary.unlink(missing_ok=True)


def apply(root, expected, archive, record, service_control=control, owner=None, install_prefix=Path('/'), install_owner=(0, 0)):
    root, record = Path(root), Path(record)
    expected = manifest(expected)
    safe_components(root, directory=True)
    safe_components(record)
    incomplete = record.parent / 'sync-incomplete'
    safe_components(incomplete)
    installed = installed_files(expected, Path(install_prefix))
    for _, target, _ in installed:
        safe_components(target)
    previous = manifest(json.loads(record.read_text())) if record.exists() else {}
    # First sync never guesses that an unknown file is old managed source.
    stale = set(previous) - set(expected)
    for name in set(previous) | set(expected):
        safe_components(root / name)
    dependencies = root / 'studio-kit/video/node_modules'
    safe_components(dependencies, directory=True)
    with tempfile.TemporaryDirectory(prefix='backroom-sync-') as temporary:
        stage = Path(temporary) / 'stage'
        stage.mkdir()
        parents = {str(parent) for name in expected for parent in PurePosixPath(name).parents if str(parent) != '.'}
        seen = set()
        with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
            for member in bundle.getmembers():
                name = member.name.rstrip('/') if member.isdir() else member.name
                source_name(name)
                if name in seen:
                    raise ValueError('duplicate archive member')
                seen.add(name)
                if member.isdir():
                    if name not in parents:
                        raise ValueError('unexpected archive directory')
                    (stage / name).mkdir(parents=True, exist_ok=True)
                elif member.isfile() and name in expected:
                    destination = stage / name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    with bundle.extractfile(member) as source, destination.open('wb') as output:
                        shutil.copyfileobj(source, output)
                    destination.chmod(0o755 if expected[name]['mode'] == '100755' else 0o644)
                else:
                    raise ValueError('unsafe archive')
        actual = {str(path.relative_to(stage)) for path in stage.rglob('*') if path.is_file()}
        if actual != set(expected):
            raise ValueError('archive manifest mismatch')
        verify(stage, expected)
        # Nothing above has touched the destination or services. Validate all
        # destination paths together again immediately before taking services down.
        for name in set(previous) | set(expected):
            safe_components(root / name)
        if owner is None:
            owner = (0, grp.getgrnam('backroom').gr_gid)
        # Persist the boot/start barrier before any source or installed copy can
        # become mixed. A failed/interrupted retry leaves it in place.
        atomic_json(incomplete, {'manifest': hashlib.sha256(json.dumps(expected, sort_keys=True).encode()).hexdigest()})
        service_control('stop')
        # Active root copies go first while all source consumers are stopped.
        for source, target, mode in installed:
            target.parent.mkdir(parents=True, exist_ok=True)
            os.chown(target.parent, *install_owner)
            target.parent.chmod(0o700 if str(target.parent).endswith('/etc/backroom') else 0o755)
            install_file(stage / source, target, mode, install_owner)
        verify_installed(installed, expected, install_owner)
        # Any failure below leaves services stopped. They start only after a
        # complete source/mode verification and durable managed-file checkpoint.
        for name in sorted(stale):
            (root / name).unlink(missing_ok=True)
            if (root / name).parent.exists(): sync_directory((root / name).parent)
        for name, meta in expected.items():
            install_file(stage / name, root / name, 0o755 if meta['mode'] == '100755' else 0o644, owner)
        if dependencies.is_dir():
            for base, dirs, files in os.walk(dependencies, followlinks=False):
                dirs[:] = [name for name in dirs if not (Path(base) / name).is_symlink()]
                folder = Path(base)
                os.chown(folder, -1, owner[1])
                folder.chmod(stat.S_IMODE(folder.stat().st_mode) | 0o050)
                for name in files:
                    file = folder / name
                    info = file.lstat()
                    if not stat.S_ISREG(info.st_mode) or (info.st_mode & 0o040 and info.st_gid == owner[1]):
                        continue
                    # pnpm can hardlink its store; isolate before changing mode.
                    if info.st_nlink != 1:
                        with tempfile.NamedTemporaryFile(dir=folder, prefix='.sync-', delete=False) as output:
                            private = Path(output.name)
                            shutil.copyfile(file, private)
                            os.chown(private, info.st_uid, owner[1])
                            private.chmod(stat.S_IMODE(info.st_mode) | 0o040)
                            private.replace(file)
                    else:
                        os.chown(file, -1, owner[1])
                        file.chmod(stat.S_IMODE(info.st_mode) | 0o040)
        verify(root, expected)
        verify_installed(installed, expected, install_owner)
        atomic_json(record, expected)
        incomplete.unlink()
        sync_directory(incomplete.parent)
        service_control('start')


def main():
    # This code is sent to one fixed host. Refuse a wrong host/user/source layout.
    if os.geteuid() != 0 or socket.gethostname() != 'backroom-dev':
        raise ValueError('wrong studio host')
    expected = manifest(json.loads(sys.argv[1]))
    required = {'scripts/studio-supervise.sh', 'desk/src/main.ts', 'scripts/identity-helper.py', 'scripts/provision-helper.py', 'scripts/studio-deploy-broker.py', 'scripts/studio-ssh.py'}
    if not required.issubset(expected):
        raise ValueError('incomplete studio source')
    root = Path('/srv/backroom')
    for name in {'scripts/studio-supervise.sh', 'desk/src/main.ts', 'scripts/identity-helper.py'}:
        safe_components(root / name)
        if not (root / name).is_file():
            raise ValueError('wrong studio tree')
    record = Path('/var/lib/backroom/studio-sync-manifest.json')
    safe_components(record)
    safe_components(record.parent, directory=True)
    with (record.parent / 'studio-sync.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        apply(root, expected, sys.stdin.buffer.read(), record)
    print('verified')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('studio sync apply failed; services remain stopped if mutation began', file=sys.stderr)
        raise SystemExit(1) from None
