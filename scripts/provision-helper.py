#!/usr/bin/env python3
"""Root service for fixed builder preparation and agent-user preflight checks."""
import contextlib
import fcntl
import grp
import json
import os
from pathlib import Path
import pwd
import re
import socket
import socketserver
import stat
import struct
import subprocess
import sys
import tempfile
import time
import tomllib
import traceback

SOCKET = '/run/backroom-provision.sock'
WORKSPACES = '/srv/backroom/workspaces'
AGENT_HOME = '/var/lib/backroom-agent'
DOCTOR = '/srv/backroom/scripts/agent-doctor.py'
PYTHON = '/run/current-system/sw/bin/python3'
MAX_OUTPUT = 16384
TIMEOUT = 180
KILL_GRACE = 30
SYSTEMD_RUN = '/run/current-system/sw/bin/systemd-run'
SYSTEMCTL = '/run/current-system/sw/bin/systemctl'
# Must match the agent controller serviceConfig in deploy/nixos/dev.nix.
AGENT_SANDBOX = [
    'NoNewPrivileges=yes', 'PrivateDevices=yes', 'ProtectSystem=strict',
    'ReadWritePaths=/var/lib/backroom-agent /srv/backroom/workspaces /tmp',
    'InaccessiblePaths=/srv/backroom/.secrets /srv/backroom/.switch-runtime /root /home/studio /run/docker.sock',
    'ProtectKernelTunables=yes', 'ProtectKernelModules=yes', 'ProtectControlGroups=yes',
    'RestrictSUIDSGID=yes', 'UMask=0007',
]
LOCK = '/run/backroom-provision.lock'
SLUG = re.compile(r'[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?')
DIRECTORY = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC


class Refused(Exception):
    pass


def validate(request):
    if not isinstance(request, dict) or set(request) != {'operation', 'project'}:
        raise Refused('invalid-request')
    if request['operation'] not in ('prepare-builder', 'doctor'):
        raise Refused('unknown-operation')
    slug = request['project']
    if not isinstance(slug, str) or not SLUG.fullmatch(slug) or slug == 'shared':
        raise Refused('bad-project')
    return request['operation'], slug


@contextlib.contextmanager
def directory(path):
    """Pin every directory component without following a symlink."""
    path = Path(path)
    if not path.is_absolute() or '..' in path.parts:
        raise Refused('unsafe-path')
    try:
        fd = os.open('/', DIRECTORY)
    except OSError:
        raise Refused('unsafe-path') from None
    try:
        for component in path.parts[1:]:
            try:
                next_fd = os.open(component, DIRECTORY, dir_fd=fd)
            except OSError:
                raise Refused('unsafe-path') from None
            os.close(fd)
            fd = next_fd
        # Errors inside the caller's block keep their real type. They are
        # reported as provision failures, never as a misleading path refusal.
        yield fd
    finally:
        os.close(fd)


@contextlib.contextmanager
def child_directory(parent, name, mode=0o750, uid=None, gid=None):
    created = False
    try:
        os.mkdir(name, mode, dir_fd=parent)
        created = True
    except FileExistsError:
        pass
    fd = os.open(name, DIRECTORY, dir_fd=parent)
    try:
        if created and uid is not None:
            os.fchown(fd, uid, gid)
            os.fchmod(fd, mode)
        yield fd
    finally:
        os.close(fd)


def read_regular(parent, name):
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    except FileNotFoundError:
        return None, None
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 1024 * 1024:
            raise Refused('unsafe-file')
        with os.fdopen(fd, 'rb', closefd=False) as stream:
            return stream.read(1024 * 1024 + 1), info
    finally:
        os.close(fd)


def atomic_write(parent, name, data, uid, gid, mode):
    temporary = '.provision-' + os.urandom(12).hex()
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=parent)
    try:
        with os.fdopen(fd, 'wb', closefd=False) as stream:
            stream.write(data)
            stream.flush()
        os.fchown(fd, uid, gid)
        os.fchmod(fd, mode)
        os.fsync(fd)
        os.rename(temporary, name, src_dir_fd=parent, dst_dir_fd=parent)
        os.fsync(parent)
    finally:
        os.close(fd)
        try:
            os.unlink(temporary, dir_fd=parent)
        except FileNotFoundError:
            pass


def builder_config(workspace):
    return ('[sandbox_workspace_write]\n'
            'writable_roots = [' + json.dumps(workspace + '/.git') + ']\n'
            'network_access = true\n').encode()


def with_trust(data, workspace):
    config = tomllib.loads(data.decode('utf-8'))
    shared = config.get('sandbox_workspace_write', {})
    if not isinstance(shared, dict) or 'writable_roots' in shared or 'network_access' in shared:
        raise Refused('shared-sandbox-policy')
    projects = config.get('projects', {})
    if not isinstance(projects, dict):
        raise Refused('agent-config-conflict')
    if workspace in projects:
        if isinstance(projects[workspace], dict) and projects[workspace].get('trust_level') == 'trusted':
            return data
        raise Refused('agent-config-conflict')
    extra = ('\n[projects.' + json.dumps(workspace) + ']\ntrust_level = "trusted"\n').encode()
    updated = data + extra
    try:
        tomllib.loads(updated.decode('utf-8'))
    except ValueError:
        raise Refused('agent-config-conflict') from None
    return updated


def prepare(slug, workspaces=WORKSPACES, agent_home=AGENT_HOME):
    group = grp.getgrnam('backroom').gr_gid
    agent = pwd.getpwnam('agent')
    if agent.pw_uid == 0 or agent.pw_uid == pwd.getpwnam('studio').pw_uid:
        raise Refused('agent-identity')
    studio = pwd.getpwnam('studio')
    workspace = str(Path(workspaces) / slug)
    # This root-owned lock is outside both writable trees, shared by all requests.
    with open(LOCK, 'a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        with directory(agent_home) as home, child_directory(home, '.codex', 0o700) as shared:
            # A newly-created shared directory must remain usable by the agent.
            info = os.fstat(shared)
            if info.st_uid == 0:
                os.fchown(shared, agent.pw_uid, group)
            old, info = read_regular(shared, 'config.toml')
            old = old if old is not None else b''
            updated = with_trust(old, workspace)
            with directory(workspace) as root:
                owner = os.fstat(root).st_uid
                if owner not in (0, studio.pw_uid):
                    raise Refused('workspace-owner')
                # Sticky parent prevents agent from renaming/replacing root's
                # .codex directory. Agent-owned workspaces are refused above.
                os.fchmod(root, stat.S_IMODE(os.fstat(root).st_mode) | stat.S_ISVTX)
                with child_directory(root, '.codex') as local:
                    read_regular(local, 'config.toml')  # refuse symlink/hardlink
                    os.fchown(local, 0, group)
                    os.fchmod(local, 0o750)
                    atomic_write(local, 'config.toml', builder_config(workspace), 0, group, 0o640)
                    if os.stat('.codex', dir_fd=root, follow_symlinks=False).st_ino != os.fstat(local).st_ino:
                        raise Refused('workspace-changed')
                with directory(Path(workspace) / '.git') as git:
                    with child_directory(git, 'info', 0o2770, studio.pw_uid, group) as info_dir:
                        excluded, exclude_info = read_regular(info_dir, 'exclude')
                        excluded = excluded if excluded is not None else b''
                        if b'.codex/' not in excluded.splitlines():
                            content = excluded + (b'\n' if excluded and not excluded.endswith(b'\n') else b'') + b'.codex/\n'
                            atomic_write(info_dir, 'exclude', content,
                                         exclude_info.st_uid if exclude_info else studio.pw_uid,
                                         exclude_info.st_gid if exclude_info else group,
                                         stat.S_IMODE(exclude_info.st_mode) if exclude_info else 0o660)
            if updated != old or info is None:
                atomic_write(shared, 'config.toml', updated,
                             info.st_uid if info else agent.pw_uid,
                             info.st_gid if info else group,
                             stat.S_IMODE(info.st_mode) if info else 0o600)


def doctor_command(unit, workspace, timeout):
    """Fixed transient unit: agent user, controller sandbox, no shell."""
    env = {'PATH': '/run/current-system/sw/bin:/opt/backroom/tools/bin', 'HOME': AGENT_HOME,
           'LANG': 'C.UTF-8', 'BACKROOM_REVIEW_BACKEND': 'local'}
    properties = [*AGENT_SANDBOX, f'RuntimeMaxSec={timeout}', 'WorkingDirectory=/', 'KillMode=control-group']
    return [SYSTEMD_RUN, '--quiet', '--wait', '--pipe', '--collect', '--service-type=exec',
            '--unit=' + unit, '--uid=agent', '--gid=backroom',
            *[part for value in properties for part in ('-p', value)],
            *[part for key, value in env.items() for part in ('-E', key + '=' + value)],
            PYTHON, '-I', '-u', DOCTOR, '--workspace', workspace]


def doctor(slug, workspaces=WORKSPACES, timeout=TIMEOUT):
    workspace = str(Path(workspaces) / slug)
    with directory(workspace):
        pass
    agent = pwd.getpwnam('agent')
    if agent.pw_uid == 0 or agent.pw_uid == pwd.getpwnam('studio').pw_uid:
        raise Refused('agent-identity')
    # The doctor runs as its own transient unit with the agent controllers'
    # sandbox, so it checks what builders really see. A root process here cannot
    # drop to agent itself: with NoNewPrivileges and seccomp, systemd starts this
    # service without CAP_SETUID. Output goes to a temporary file, never an
    # unbounded pipe. RuntimeMaxSec stops the whole unit, including temporary
    # database and browser processes; a late systemd-run is killed by unit name.
    unit = 'backroom-doctor-' + os.urandom(6).hex()
    with tempfile.TemporaryFile() as output:
        started = time.monotonic()
        process = subprocess.Popen(doctor_command(unit, workspace, timeout),
            cwd='/', env={'PATH': '/run/current-system/sw/bin', 'LANG': 'C.UTF-8'},
            stdin=subprocess.DEVNULL, stdout=output, stderr=subprocess.DEVNULL)
        try:
            code = process.wait(timeout=timeout + KILL_GRACE)
        except subprocess.TimeoutExpired:
            for action in (['kill', '--signal=SIGKILL'], ['stop']):
                subprocess.run([SYSTEMCTL, *action, unit + '.service'], stdin=subprocess.DEVNULL,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30)
            process.kill()
            process.wait()
            code = None
        timed_out = code is None or (code != 0 and time.monotonic() - started >= timeout)
        output.seek(0)
        text = output.read(MAX_OUTPUT + 1)
        if len(text) > MAX_OUTPUT:
            return {'ok': False, 'category': 'doctor-output-limit',
                    'output': 'FAIL doctor output limit — fix: inspect the fixed agent doctor.'}
    text = text.decode('utf-8', errors='replace')
    if timed_out:
        message = '\nFAIL doctor timeout — fix: repair the agent environment and Retry.'
        return {'ok': False, 'category': 'doctor-timeout',
                'output': text.encode()[:MAX_OUTPUT - len(message.encode())].decode('utf-8', errors='ignore') + message}
    if code != 0 and not any(line.startswith('FAIL ') for line in text.splitlines()):
        text = 'FAIL doctor execution — fix: repair the fixed agent doctor.\n' + text
        text = text.encode()[:MAX_OUTPUT].decode('utf-8', errors='ignore')
    return {'ok': code == 0, 'category': 'doctor-passed' if code == 0 else 'doctor-failed', 'output': text}


def authorized(uid, gid):
    # Shared group membership is socket access, never operation authority.
    # Agent sessions share that group but may not invoke this root service.
    return uid == 0 or uid == pwd.getpwnam('studio').pw_uid


def dispatch(request, uid, gid):
    if not authorized(uid, gid):
        raise Refused('caller-group')
    operation, slug = validate(request)
    if operation == 'prepare-builder':
        prepare(slug)
        return {'ok': True, 'category': 'builder-prepared', 'output': ''}
    return doctor(slug)


def failure_summary(error):
    """Error type, errno and the helper line only: no paths, values or input."""
    frames = traceback.extract_tb(error.__traceback__)
    where = next((f'{frame.name}:{frame.lineno}' for frame in reversed(frames)
                  if frame.filename == __file__), 'unknown')
    code = getattr(error, 'errno', None)
    return type(error).__name__ + (f' errno={code}' if code else '') + ' at ' + where


def log(message):
    print('provision: ' + message, file=sys.stderr, flush=True)


class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(5)
        try:
            _, uid, gid = struct.unpack('3i', self.connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
            line = self.rfile.readline(4097)
            if len(line) > 4096 or not line.endswith(b'\n'):
                raise Refused('invalid-request')
            result = dispatch(json.loads(line), uid, gid)
        except Refused as error:
            result = {'ok': False, 'category': str(error), 'output': ''}
            log('refused: ' + str(error))
        except Exception as error:
            result = {'ok': False, 'category': 'provision-failed', 'output': ''}
            log('failed: ' + failure_summary(error))
        self.wfile.write(json.dumps(result).encode() + b'\n')


class Server(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True


def main():
    if os.path.lexists(SOCKET):
        if not stat.S_ISSOCK(os.lstat(SOCKET).st_mode):
            raise Refused('unsafe-socket')
        os.unlink(SOCKET)
    with Server(SOCKET, Handler) as server:
        os.chown(SOCKET, 0, grp.getgrnam('backroom').gr_gid)
        os.chmod(SOCKET, 0o660)
        server.serve_forever()


if __name__ == '__main__':
    main()
