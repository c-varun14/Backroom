"""Offline-testable, fixed-allowlist studio migration driver.

This module does nothing live on import. Never print exceptions or subprocess
output: HTTP errors, config text, tar diagnostics and CLI logs can hold secrets.
"""
import argparse
import fcntl
import io
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import signal
import sqlite3
import stat
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
HOST = 'backroom-dev'
REMOTE = '/srv/backroom'
SECRETS = ('switch.env', 'discord.env', 'block1-credentials.json',
           'real-stage-credentials.json', 'studio-door-webhook',
           'backroom-demo-ip.txt', 'spike-state.json', 'keys-signing-key', 'projects')
CONTROLLERS = {'block1-lead-controller': 'lead', 'real-build-controller': 'build'}
STATE = ('block1.json', 'studio.json', 'discord-layout.json', 'door.sqlite',
         'door.sqlite-wal', 'door.sqlite-shm', 'projects', 'project-state', 'provision', 'nix-deploy')
UNITS = ('backroom-switch', 'backroom-controller-lead', 'backroom-controller-build', 'backroom-studio')
NEW_SOURCE = ('scripts/studio-move.sh', 'scripts/studio_move.py', 'scripts/studio-supervise.sh',
              'scripts/studio_supervise.py', 'scripts/studio-switch-watch.sh',
              'scripts/studio-install-tools.sh', 'scripts/studio-verify.py', 'scripts/studio-ssh.py',
              'scripts/studio-deploy-broker.py', 'scripts/shadow_git.py', 'desk/src/trusted-git.ts',
              'scripts/repro/test-studio-move.py', 'docs/STUDIO-SERVER.md')


def status(name, result):
    print(name + ': ' + result, flush=True)


def run(args, **kwargs):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if result.returncode:
        raise RuntimeError('command failed')
    return result.stdout


def ssh(command, **kwargs):
    return run(['ssh', '-o', 'BatchMode=yes', HOST, command], **kwargs)


def compose(*args):
    return ['docker', 'compose', '-p', 'backroom-block0', '--env-file', '.secrets/switch.env',
            '-f', '.switch-runtime/compose.yml', '--profile', 'gateway', *args]


def forbidden(path):
    for part in path.parts:
        name = part.lower().lstrip('.')
        if (name.endswith('.pem') or name in {'archives', 'archive'} or
                name.startswith(('console-profile', 'provider-state', 'archived', 'archive.'))):
            return True
    return False


def allowed_payload_path(path):
    if path.is_absolute() or '..' in path.parts or not path.parts or forbidden(path):
        return False
    parts = path.parts
    if parts[0] == '.secrets':
        return len(parts) >= 2 and parts[1] in SECRETS and (parts[1] == 'projects' or len(parts) == 2)
    if parts[0] == 'controllers':
        return len(parts) >= 3 and parts[1] in CONTROLLERS.values() and parts[2] in {
            'controller.db', 'controller.db-wal', 'controller.db-shm', 'agents', 'secrets', 'watchers'} and (parts[2] in {'agents', 'secrets', 'watchers'} or len(parts) == 3)
    if parts[0] == '.switch-runtime':
        return len(parts) >= 2 and parts[1] in STATE and (parts[1] in {'projects', 'project-state', 'provision', 'nix-deploy'} or len(parts) == 2)
    if parts[0] == 'workspaces':
        return len(parts) > 1 and not any(p in {'.secrets', 'node_modules', '.cache', '.venv', '__pycache__'} or
            (p.startswith('.env') and p not in {'.env.schema', '.env.example', '.env.required'}) for p in parts[1:])
    return False


def regular_tree(base, relative):
    """Reject links/devices, including parent symlinks. Do not follow escapes."""
    if relative.parts and relative.parts[0] == 'workspaces' and not allowed_payload_path(relative) and len(relative.parts) > 1:
        return
    path = base
    for part in relative.parts:
        path = path / part
        if path.is_symlink():
            raise ValueError('symlink refused')
    if not path.exists():
        return
    if forbidden(relative):
        return
    mode = path.lstat().st_mode
    if stat.S_ISDIR(mode):
        for child in sorted(path.iterdir()):
            yield from regular_tree(base, child.relative_to(base))
    elif stat.S_ISREG(mode):
        yield relative
    else:
        raise ValueError('nonregular file refused')


def payload_files(root):
    for name in SECRETS:
        yield from regular_tree(root, Path('.secrets') / name)
    for name, target in CONTROLLERS.items():
        base = root / '.secrets' / name
        # These are the controller's live stores. Never copy its whole home.
        for child in ('controller.db', 'controller.db-wal', 'controller.db-shm', 'agents', 'secrets', 'watchers'):
            for relative in regular_tree(root, Path('.secrets') / name / child):
                yield relative
    for name in STATE:
        yield from regular_tree(root, Path('.switch-runtime') / name)
    # Product code, Git state and reports are needed for deployed-commit checks.
    # Explicitly exclude local credentials/dotenv and dependency caches.
    for relative in regular_tree(root, Path('workspaces')):
        if any(p in {'.secrets', 'node_modules', '.cache', '.venv', '__pycache__'} or
               (p.startswith('.env') and p not in {'.env.schema', '.env.example', '.env.required'}) for p in relative.parts):
            continue
        yield relative


def pack_payload(root, output):
    with tarfile.open(output, 'w') as archive:
        for relative in payload_files(root):
            target = relative
            if len(relative.parts) > 2 and relative.parts[0] == '.secrets' and relative.parts[1] in CONTROLLERS:
                target = Path('controllers') / CONTROLLERS[relative.parts[1]] / Path(*relative.parts[2:])
            info = archive.gettarinfo(str(root / relative), arcname=str(target))
            info.uid = info.gid = 0
            info.uname = info.gname = ''
            info.mode = 0o770 if relative.parts[0] == 'workspaces' and info.mode & 0o111 else 0o660 if relative.parts[0] == 'workspaces' else 0o600
            with (root / relative).open('rb') as file:
                archive.addfile(info, file)


def rewrite(value, old_root):
    if isinstance(value, str):
        for name, target in CONTROLLERS.items():
            value = value.replace(old_root + '/.secrets/' + name, '/var/lib/backroom-agent/' + target)
        return value.replace(old_root, REMOTE)
    if isinstance(value, list):
        return [rewrite(v, old_root) for v in value]
    if isinstance(value, dict):
        return {k: rewrite(v, old_root) for k, v in value.items()}
    return value


def rewrite_sqlite(path, old_root):
    # SQLite parameters keep opaque values out of SQL and diagnostics.
    with sqlite3.connect(path) as db:
        for (table,) in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").fetchall():
            quote = lambda s: '"' + s.replace('"', '""') + '"'
            for col in db.execute('PRAGMA table_info(' + quote(table) + ')').fetchall():
                name = quote(col[1])
                # Preserve bytes and numeric types; replace only literal root paths.
                for old, new in [(old_root + '/.secrets/' + n, '/var/lib/backroom-agent/' + t) for n, t in CONTROLLERS.items()] + [(old_root, REMOTE)]:
                    db.execute('UPDATE ' + quote(table) + ' SET ' + name + '=replace(' + name + ',?,?) WHERE typeof(' + name + ")='text' AND instr(" + name + ',?)>0', (old, new, old))
        db.commit()
        db.execute('PRAGMA wal_checkpoint(TRUNCATE)')


def install_payload(stage, old_root):
    """Root-only server-side action, never invoked by offline tests."""
    import pwd
    import grp
    studio = pwd.getpwnam('studio').pw_uid
    agent = pwd.getpwnam('agent').pw_uid
    group = grp.getgrnam('backroom').gr_gid
    backup = Path('/var/lib/backroom/studio-backups') / str(time.time_ns())
    backup.mkdir(mode=0o700, parents=True)
    # These are agent-writable trees. Hide their parent before replacing them,
    # so old symlinks cannot redirect root's import to protected files.
    home = Path('/var/lib/backroom-agent')
    os.chown(home, 0, 0)
    home.chmod(0o700)
    try:
        for sub in ('.secrets', '.switch-runtime', 'controllers', 'workspaces'):
            source = stage / sub
            if not source.exists():
                continue
            target = home if sub == 'controllers' else Path(REMOTE) / sub
            if sub == 'controllers':
                for name in CONTROLLERS.values():
                    previous = target / name
                    if previous.exists() or previous.is_symlink():
                        previous.rename(backup / ('controller-' + name))
            elif sub == 'workspaces' and (target.exists() or target.is_symlink()):
                target.rename(backup / 'workspaces')
            target.mkdir(mode=0o700, exist_ok=True)
            # All incoming members were extracted as regular files. The fresh
            # agent-writeable targets have no old symlinks to follow.
            shutil.copytree(source, target, dirs_exist_ok=True)
            roots = [target / name for name in CONTROLLERS.values()] if sub == 'controllers' else [target]
            for tree in roots:
                if not tree.exists():
                    continue
                for base, dirs, files in os.walk(tree, topdown=False, followlinks=False):
                    directory = Path(base)
                    if directory.is_symlink() or any((directory / d).is_symlink() for d in dirs):
                        raise ValueError('destination symlink refused')
                    for name in files:
                        file = directory / name
                        if file.is_symlink():
                            raise ValueError('destination symlink refused')
                        if sub in {'.switch-runtime', 'controllers'} and file.suffix == '.json':
                            file.write_text(json.dumps(rewrite(json.loads(file.read_text()), old_root), indent=2))
                        if sub in {'.switch-runtime', 'controllers'} and file.suffix in {'.db', '.sqlite'}:
                            rewrite_sqlite(file, old_root)
                        os.chown(file, agent if sub == 'controllers' else studio, group)
                        file.chmod((0o770 if file.stat().st_mode & 0o111 else 0o660) if sub == 'workspaces' else 0o600)
                    os.chown(directory, agent if sub == 'controllers' else studio, group)
                    directory.chmod(0o2770 if sub == 'workspaces' else 0o700)
    finally:
        os.chown(home, agent, group)
        home.chmod(0o700)
    # Compose never reads studio-owned env files, including after a restart.
    switch_env = stage / '.secrets/switch.env'
    if switch_env.exists():
        target = Path('/etc/backroom/switch.env')
        shutil.copyfile(switch_env, target)
        os.chown(target, 0, 0)
        target.chmod(0o600)
    status('allowlisted state', 'installed')


def processes(root):
    """Only this checkout and this UID. Never match unrelated containers/projects."""
    found = {}
    descendants = {}
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit() or int(entry.name) == os.getpid():
            continue
        try:
            if entry.stat().st_uid != os.getuid():
                continue
            args = (entry / 'cmdline').read_bytes().split(b'\0')
            args = [a.decode(errors='replace') for a in args if a]
            if not args:
                continue
            cwd = (entry / 'cwd').resolve()
            fields = (entry / 'stat').read_text().rsplit(')', 1)[1].split()
            descendants[int(entry.name)] = (int(fields[1]), fields[19])
            executable = Path(args[0]).name
            text = '\0'.join(args)
            scoped = cwd == root or str(root) + '/' in text
            # Controllers' agent descendants are stopped with their controller;
            # additionally include exact provider processes inside this checkout.
            known = executable in {'node', 'bun', 'bash', 'python3', 'claude', 'codex'} and any(
                marker in text for marker in ('desk/src/door', 'desk/src/main', 'run-door.sh', 'run-desk.sh',
                'controller/package/cli.mjs', 'studio-supervise', 'studio_supervise.py'))
            if scoped and known:
                birth = (entry / 'stat').read_text().rsplit(')', 1)[1].split()[19]
                found[int(entry.name)] = birth
        except (OSError, ValueError):
            continue
    changed = True
    while changed:
        changed = False
        for pid, (parent, birth) in descendants.items():
            if pid not in found and parent in found and pid != os.getpid():
                found[pid] = birth
                changed = True
    return found


def stop_laptop(root):
    # Stop launchers first; repeat to catch children launched during shutdown.
    for _ in range(3):
        current = processes(root)
        for pid, birth in current.items():
            try:
                if Path('/proc', str(pid), 'stat').read_text().rsplit(')', 1)[1].split()[19] != birth:
                    continue
                os.kill(pid, signal.SIGTERM)
            except (ProcessLookupError, FileNotFoundError):
                pass
        deadline = time.monotonic() + 15
        while processes(root) and time.monotonic() < deadline:
            time.sleep(.25)
        if not processes(root):
            break
    if processes(root):
        raise RuntimeError('laptop processes remain')
    run(compose('stop'), cwd=root)
    # Compose's stopped state is a hard precondition before the server starts.
    if run(compose('ps', '--status', 'running', '-q'), cwd=root).strip():
        raise RuntimeError('laptop containers remain')
    status('laptop stack', 'stopped')


def transfer_commit(root):
    """Send local HEAD's history over SSH; no public remote or push is needed."""
    with tempfile.TemporaryDirectory(prefix='backroom-source-') as temporary:
        bundle = Path(temporary) / 'source.bundle'
        run(['git', 'bundle', 'create', str(bundle), 'HEAD'], cwd=root)
        # Fetch on EVERY prepare, including an existing checkout. The source
        # overlay below carries this task's uncommitted edits after checkout.
        # Source metadata is root-owned and outside the studio/agent trees.
        # Rename old source entries as directory entries, without traversing
        # them. A compromised studio from the old layout cannot redirect root's
        # checkout/overlay through an old symlink. State stays in place.
        reset = '''import os, stat, time
from pathlib import Path
root=Path('/srv/backroom')
backup=Path('/var/lib/backroom') / ('source-backup-'+str(time.time_ns()))
backup.mkdir(mode=0o700)
for name in ('.secrets','.switch-runtime','workspaces'):
    path=root/name
    if path.exists() or path.is_symlink():
        if not stat.S_ISDIR(path.lstat().st_mode): raise ValueError('State directory link refused')
for path in root.iterdir():
    if path.name not in {'.secrets','.switch-runtime','workspaces'}:
        path.rename(backup/path.name)
'''
        command = ('set -e; umask 077; '
                   'install -d -m 700 /var/lib/backroom; '
                   'install -d -m 750 -o root -g backroom /srv/backroom; '
                   'python3 -I -c ' + shlex.quote(reset) + '; '
                   'if ! test -d /var/lib/backroom/source.git; then '
                   'GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null git init -q --bare --template= /var/lib/backroom/source.git; fi; '
                   'cat > /var/lib/backroom/studio-source.bundle; '
                   'trap "rm -f /var/lib/backroom/studio-source.bundle" EXIT; '
                   'export GIT_NO_REPLACE_OBJECTS=1 GIT_CONFIG_NOSYSTEM=1 GIT_CONFIG_GLOBAL=/dev/null; '
                   'git --git-dir=/var/lib/backroom/source.git fetch -q /var/lib/backroom/studio-source.bundle HEAD; '
                   'git --git-dir=/var/lib/backroom/source.git --work-tree=/srv/backroom -c core.hooksPath=/dev/null checkout -q -f -B client-studio FETCH_HEAD')
        with bundle.open('rb') as source:
            ssh(command, stdin=source)



def prepare(root):
    ssh('mkdir -p /etc/backroom')
    # Copy root-consumed artifacts via the owner's root connection BEFORE any
    # service config references them. Never execute studio-owned installation code.
    for name in ('studio-switch-watch.sh', 'studio-install-tools.sh', 'studio-deploy-broker.py', 'studio-ssh.py'):
        run(['scp', '-q', str(root / 'scripts' / name), HOST + ':/etc/backroom/' + name])
    run(['scp', '-q', str(root / 'deploy/nixos/dev.nix'), HOST + ':/etc/backroom/dev.nix'])
    run(['scp', '-q', str(root / '.switch-runtime/compose.yml'), HOST + ':/etc/backroom/switch-compose.yml'])
    ssh('chown -R root:root /etc/backroom && chmod 700 /etc/backroom && chmod 600 /etc/backroom/*')
    ssh('nixos-rebuild switch -I nixos-config=/etc/backroom/dev.nix')
    status('server config', 'applied')
    transfer_commit(root)
    # Ship working-tree source too: this spec explicitly forbids making commits.
    tracked = run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root).decode().split('\0')
    with tempfile.TemporaryFile() as source:
        with tarfile.open(fileobj=source, mode='w') as archive:
            for name in sorted(set(filter(None, tracked)) | set(NEW_SOURCE)):
                path = Path(name)
                if path.is_absolute() or '..' in path.parts or path.parts[0] in {'.secrets', '.switch-runtime', '.git', 'workspaces'}:
                    continue
                file = root / path
                if file.is_file() and not file.is_symlink():
                    info = archive.gettarinfo(str(file), arcname=name)
                    info.mode = 0o750 if info.mode & 0o111 else 0o640
                    with file.open('rb') as content:
                        archive.addfile(info, content)
        source.seek(0)
        run(['ssh', '-o', 'BatchMode=yes', HOST, 'tar --no-same-owner -xf - -C /srv/backroom'], stdin=source)
    # Only the immutable shipped controller package, never its data directory.
    with tempfile.TemporaryFile() as package:
        with tarfile.open(fileobj=package, mode='w') as archive:
            base = root / '.switch-runtime/controller/package'
            for relative in regular_tree(base, Path('.')):
                archive.add(base / relative, arcname=str(relative), recursive=False)
        package.seek(0)
        ssh('install -d -m 755 /opt/backroom/controller')
        run(['ssh', '-o', 'BatchMode=yes', HOST, 'tar --no-same-owner -xf - -C /opt/backroom/controller && chown -R root:root /opt/backroom/controller && chmod -R a+rX,go-w /opt/backroom/controller'], stdin=package)
    ssh('chmod -R g+rX,go-w /srv/backroom/desk /srv/backroom/deploy /srv/backroom/harness /srv/backroom/studio-kit /srv/backroom/scripts')
    # Root owns code, helpers and all Compose inputs. Studio owns only state.
    ssh('chown root:backroom /srv/backroom && chmod 750 /srv/backroom; chown -R root:backroom /srv/backroom/desk /srv/backroom/deploy /srv/backroom/harness /srv/backroom/studio-kit /srv/backroom/scripts; chown -R root:root /var/lib/backroom/fleet && chmod -R go-w /var/lib/backroom/fleet')
    ssh('bash /etc/backroom/studio-install-tools.sh')
    # Repo source is read-only to agent; workspaces alone are shared writable.
    ssh('chmod -R g+rX,go-w /srv/backroom/desk /srv/backroom/harness /srv/backroom/studio-kit /srv/backroom/scripts; chmod 700 /srv/backroom/.secrets /srv/backroom/.switch-runtime; install -d -m 700 /var/lib/backroom')
    status('server source and tools', 'prepared')


def login_help():
    # Commands only, no environment, allowlisted file or credential is consulted.
    print("ssh -t backroom-dev \"runuser -l agent -c 'claude auth login'\"")
    print("ssh -t backroom-dev \"runuser -l agent -c 'codex login --device-auth'\"")
    print("ssh -t backroom-dev \"runuser -l studio -c 'gh auth login --hostname github.com --web --git-protocol https && gh auth setup-git'\"")


def cutover(root, position):
    ssh('test -f /opt/backroom/tools/.pinned-2.1.319-0.167.0 && test -f /opt/backroom/controller/cli.mjs')
    # Preflight only checks required path existence, never credentials on stdout.
    for name in SECRETS:
        if name != 'projects' and not (root / '.secrets' / name).is_file():
            raise RuntimeError('required allowlisted file missing')
    for name in CONTROLLERS:
        if not (root / '.secrets' / name / 'controller.db').is_file():
            raise RuntimeError('controller state missing')
    # spike-state.json supplies the existing provisioning identity. Old Switch
    # definitions remain stopped/retired and untouched; new projects create
    # fresh agents with server paths. No definition-rewrite checkpoint is needed.
    stop_laptop(root)
    if position.get('phase') not in {'imported', 'complete'}:
        ssh('systemctl stop backroom-studio backroom-controller-build backroom-controller-lead backroom-switch')
        with tempfile.TemporaryDirectory(prefix='backroom-move-') as temporary:
            stage = Path(temporary)
            payload = stage / 'payload.tar'
            pack_payload(root, payload)
            run(['scp', '-q', str(payload), HOST + ':/var/lib/backroom/studio-payload.tar'])
            with (stage / 'pgdata.tar').open('wb') as file:
                # Only the named Switch volume; no other containers are inspected.
                result = subprocess.run(['docker', 'run', '--rm', '--network', 'none', '--mount',
                    'type=volume,src=backroom-block0_pgdata,dst=/source,readonly', 'alpine:3.22',
                    'tar', '-C', '/source', '-cpf', '-', '.'], cwd=root, stdout=file, stderr=subprocess.DEVNULL)
                if result.returncode:
                    raise RuntimeError('volume export failed')
            run(['scp', '-q', str(stage / 'pgdata.tar'), HOST + ':/var/lib/backroom/studio-pgdata.tar'])
        # Staging files are root-only and never placed in the agent-readable repo.
        old_root = str(root)
        ssh('python3 /srv/backroom/scripts/studio_move.py _install ' + shlex.quote(old_root))
        ssh('docker volume create backroom-block0_pgdata >/dev/null && docker run --rm --network none --mount type=volume,src=backroom-block0_pgdata,dst=/target --mount type=bind,src=/var/lib/backroom/studio-pgdata.tar,dst=/backup.tar,readonly alpine:3.22 sh -c \'find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + && tar -xpf /backup.tar -C /target\'')
        position['phase'] = 'imported'
        save_position(root, position)
        ssh('rm -f /var/lib/backroom/studio-payload.tar /var/lib/backroom/studio-pgdata.tar')
        status('Switch volume', 'copied; original retained')
    ssh('touch /srv/backroom/.switch-runtime/studio-move-ready && chown studio:backroom /srv/backroom/.switch-runtime/studio-move-ready')
    # A completed checkpoint from an older migration does not prove the new
    # root-owned Compose input exists. Refuse startup until the owner imports it.
    ssh('test -f /etc/backroom/switch.env && test "$(stat -c %u:%g:%a /etc/backroom/switch.env)" = 0:0:600')
    for unit in UNITS:
        ssh('systemctl start ' + unit)
        status(unit, 'start requested')
    position['phase'] = 'complete'
    save_position(root, position)


def save_position(root, value):
    file = root / '.switch-runtime/studio-move-position.json'
    temporary = file.with_suffix('.tmp')
    temporary.write_text(json.dumps(value))
    temporary.chmod(0o600)
    temporary.replace(file)


def verify():
    # Forward only the verifier's names-only protocol, never native diagnostics.
    result = subprocess.run(['ssh', '-o', 'BatchMode=yes', HOST,
        'python3 /srv/backroom/scripts/studio-verify.py ' + shlex.quote(str(ROOT))],
        capture_output=True, text=True)
    for line in result.stdout.splitlines():
        if line.startswith('agent definition: '):
            name = json.loads(line[len('agent definition: '):])
            if not isinstance(name, str):
                raise ValueError('invalid verifier result')
            status('agent definition', json.dumps(name, ensure_ascii=True))
    if result.returncode:
        raise RuntimeError('verification failed')
    for name in ('Switch health', 'lead controller connected', 'build controller connected', 'running agent definition paths', 'door process', 'agent protected paths', 'metadata blocked', 'Switch database blocked', 'studio localhost SSH'):
        status(name, 'passed')
    status('server verification', 'passed')


def rollback(root, position):
    # Fail closed: if dev cannot be confirmed stopped, never open a second gateway.
    ssh('systemctl stop backroom-studio backroom-controller-build backroom-controller-lead backroom-switch && rm -f /srv/backroom/.switch-runtime/studio-move-ready && ! systemctl is-active --quiet backroom-studio backroom-controller-build backroom-controller-lead backroom-switch')
    run(compose('up', '-d', '--wait', '--wait-timeout', '180'), cwd=root)
    for name in CONTROLLERS:
        marker = str(root / '.secrets' / name)
        # Identity-aware check prevents a repeated rollback duplicating controllers.
        existing = any(marker.encode() in Path('/proc', str(pid), 'cmdline').read_bytes() for pid in processes(root))
        if not existing:
            subprocess.Popen(['node', str(root / '.switch-runtime/controller/package/cli.mjs'), 'run', '--data-dir', marker],
                             cwd=root, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, start_new_session=True)
    subprocess.Popen(['bash', str(root / 'scripts/studio-supervise.sh')], cwd=root,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                     start_new_session=True)
    # Preserve imported server data on repeat cutover; never overwrite its progress.
    position['location'] = 'laptop'
    position['phase'] = 'rolled-back'
    save_position(root, position)
    status('laptop stack', 'restart requested; original data retained')


def install_from_archive(old_root):
    # Our own payload contains only regular files, all paths checked again here.
    with tempfile.TemporaryDirectory(dir='/var/lib/backroom', prefix='studio-import-') as temporary:
        stage = Path(temporary)
        with tarfile.open('/var/lib/backroom/studio-payload.tar') as archive:
            for member in archive.getmembers():
                name = Path(member.name)
                if not member.isfile() or not allowed_payload_path(name):
                    raise ValueError('archive member refused')
                target = stage / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, target.open('wb') as output:
                    shutil.copyfileobj(source, output)
                target.chmod(member.mode)
        install_payload(stage, old_root)


def main():
    parser = argparse.ArgumentParser(description='Studio migration; no values are printed')
    parser.add_argument('command', choices=['prepare', 'login-help', 'cutover', 'verify', 'rollback', '_install'])
    parser.add_argument('old_root', nargs='?')
    args = parser.parse_args()
    os.umask(0o077)
    if args.command == 'login-help':
        login_help()
        return
    if args.command == '_install':
        if os.getuid() != 0 or not args.old_root or not args.old_root.startswith('/'):
            raise ValueError('root install required')
        install_from_archive(args.old_root)
        return
    (ROOT / '.switch-runtime').mkdir(mode=0o700, exist_ok=True)
    with (ROOT / '.switch-runtime/studio-move.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        file = ROOT / '.switch-runtime/studio-move-position.json'
        position = json.loads(file.read_text()) if file.exists() else {}
        if args.command == 'prepare': prepare(ROOT)
        elif args.command == 'cutover': cutover(ROOT, position)
        elif args.command == 'verify': verify()
        elif args.command == 'rollback': rollback(ROOT, position)


if __name__ == '__main__':
    try:
        main()
    except Exception:
        status('studio move', 'failed; details withheld; see docs/STUDIO-SERVER.md')
        raise SystemExit(1) from None
