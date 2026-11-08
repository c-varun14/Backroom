"""Offline provision-helper regressions: real temporary trees and processes."""
import contextlib
import ast
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


helper = load('provision_helper', 'scripts/provision-helper.py')
doctor = load('agent_doctor', 'scripts/agent-doctor.py')
projects = load('new_project', 'scripts/new_project.py')


class ProvisionTests(unittest.TestCase):
    @contextlib.contextmanager
    def fixture(self):
        with tempfile.TemporaryDirectory(prefix='backroom-provision-') as temporary:
            root = Path(temporary)
            workspace = root / 'workspaces/sample'
            (workspace / '.git/info').mkdir(parents=True)
            home = root / 'agent'
            (home / '.codex').mkdir(parents=True)
            agent = SimpleNamespace(pw_uid=os.getuid() + 1, pw_name='agent')
            studio = SimpleNamespace(pw_uid=os.getuid(), pw_name='studio')
            group = SimpleNamespace(gr_gid=os.getgid())
            changes = []
            # Root ownership and credential drops cannot be applied as UID 1000.
            # Record them without changing policy; tree/path/mode operations are real.
            def chown(fd, uid, gid):
                changes.append((os.readlink('/proc/self/fd/' + str(fd)), uid, gid))
            with patch.object(helper.pwd, 'getpwnam', side_effect=lambda name: agent if name == 'agent' else studio), patch.object(helper.grp, 'getgrnam', return_value=group), patch.object(helper.os, 'fchown', side_effect=chown), patch.object(helper, 'LOCK', str(root / 'lock')):
                yield root, workspace, home, changes

    def prepare(self, root, home):
        helper.prepare('sample', str(root / 'workspaces'), str(home))

    def test_preserves_existing_config_and_exclude_and_is_idempotent(self):
        with self.fixture() as (root, workspace, home, changes):
            original = b'# Keep this formatting.\nmodel = "gpt-6.1-sol"\n\n[projects."/fictional/old"]\ntrust_level = "trusted"\n'
            shared = home / '.codex/config.toml'
            shared.write_bytes(original)
            shared.chmod(0o640)
            before = shared.stat()
            exclude = workspace / '.git/info/exclude'
            exclude.write_bytes(b'# fictional existing exclude\n/dist\n')
            self.prepare(root, home)
            after = shared.read_bytes()
            self.assertTrue(after.startswith(original))
            self.assertEqual(after[len(original):], ('\n[projects.' + json.dumps(str(workspace)) + ']\ntrust_level = "trusted"\n').encode())
            self.assertEqual(stat.S_IMODE(shared.stat().st_mode), 0o640)
            self.assertIn((str(home / '.codex') + '/.provision-', before.st_uid, before.st_gid),
                          [(name.rsplit('-', 1)[0] + '-', uid, gid) for name, uid, gid in changes if '/.provision-' in name])
            self.assertEqual(exclude.read_bytes(), b'# fictional existing exclude\n/dist\n.codex/\n')
            config = workspace / '.codex/config.toml'
            self.assertEqual(config.read_bytes(), helper.builder_config(str(workspace)))
            self.assertEqual(stat.S_IMODE(config.stat().st_mode), 0o640)
            self.assertEqual(stat.S_IMODE(config.parent.stat().st_mode), 0o750)
            self.assertTrue(workspace.stat().st_mode & stat.S_ISVTX)
            self.assertTrue(any(uid == 0 and gid == os.getgid() for _, uid, gid in changes))
            self.prepare(root, home)
            self.assertEqual(shared.read_bytes(), after)
            self.assertEqual(exclude.read_bytes(), b'# fictional existing exclude\n/dist\n.codex/\n')
            self.assertEqual(config.read_bytes(), helper.builder_config(str(workspace)))
            self.assertFalse(list(root.rglob('.provision-*')))

    def test_slugs_unknown_operations_and_extra_fields_are_refused(self):
        for slug in ['', '..', '../other', '/absolute', 'sample/other', 'sample;id', 'shared', 'UPPER', '-sample', 'x' * 61, None]:
            with self.subTest(slug=slug), self.assertRaises(helper.Refused):
                helper.validate({'operation': 'doctor', 'project': slug})
        for request in [{'operation': 'shell', 'project': 'sample'},
                        {'operation': 'doctor', 'project': 'sample', 'path': '/fictional'}, [], None]:
            with self.assertRaises(helper.Refused): helper.validate(request)
        self.assertEqual(helper.validate({'operation': 'prepare-builder', 'project': 'sample-2'}), ('prepare-builder', 'sample-2'))

    def test_new_git_info_permissions_survive_service_umask(self):
        with self.fixture() as (root, workspace, home, _):
            (workspace / '.git/info').rmdir()
            old = os.umask(0o077)
            try:
                self.prepare(root, home)
            finally:
                os.umask(old)
            self.assertEqual(stat.S_IMODE((workspace / '.git/info').stat().st_mode), 0o2770)
            self.assertEqual(stat.S_IMODE((workspace / '.git/info/exclude').stat().st_mode), 0o660)

    def test_prepare_runs_before_any_builder_creation_or_start(self):
        source = (ROOT / 'scripts/real_setup.py').read_text()
        tree = ast.parse(source)
        function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'create_role')
        events = []
        harness = SimpleNamespace(role_config=lambda _: {'harness': 'command'},
                                  command_role=lambda *args: events.append('start') or {'id': 'sample'})
        namespace = {'prepare_builder': lambda *_: events.append('prepare')}
        with patch.dict(sys.modules, {'harness_config': harness}):
            exec(compile(ast.Module(body=[function], type_ignores=[]), '<create_role>', 'exec'), namespace)
            namespace['create_role']({}, 'builder', 'builder-sample', '/fictional/sample')
            self.assertEqual(events, ['prepare', 'start'])
            events.clear()
            def refused(*_): raise helper.Refused('provision-failed')
            namespace['prepare_builder'] = refused
            with self.assertRaises(helper.Refused):
                namespace['create_role']({}, 'builder', 'builder-sample', '/fictional/sample')
            self.assertEqual(events, [])
        self.assertIn("prepare_builder(c, c['workspace'])", source.split("elif action=='start-builder':", 1)[1])

    def test_doctor_never_runs_as_root_or_studio(self):
        with self.fixture() as (root, _workspace, _home, _):
            for uid in [0, os.getuid()]:
                with patch.object(helper.pwd, 'getpwnam', return_value=SimpleNamespace(pw_uid=uid)), patch.object(helper.subprocess, 'Popen') as execute:
                    with self.assertRaisesRegex(helper.Refused, 'agent-identity'):
                        helper.doctor('sample', str(root / 'workspaces'))
                    execute.assert_not_called()

    def test_symlink_at_every_workspace_and_shared_config_component_is_refused(self):
        for component in ['workspaces', 'workspaces/sample', 'workspaces/sample/.git',
                          'workspaces/sample/.git/info', 'workspaces/sample/.git/info/exclude',
                          'workspaces/sample/.codex', 'workspaces/sample/.codex/config.toml',
                          'agent', 'agent/.codex', 'agent/.codex/config.toml']:
            with self.subTest(component=component), self.fixture() as (root, workspace, home, _):
                target = root / component
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    target.rename(target.with_name(target.name + '-original'))
                outside = root / 'outside'
                outside.mkdir(exist_ok=True)
                sentinel = outside / 'sentinel'
                sentinel.write_text('fictional protected bytes')
                target.symlink_to(outside if component.split('/')[-1] not in ('exclude', 'config.toml') else sentinel)
                with self.assertRaises((helper.Refused, OSError)):
                    self.prepare(root, home)
                self.assertEqual(sentinel.read_text(), 'fictional protected bytes')
                self.assertEqual(sorted(path.name for path in outside.iterdir()), ['sentinel'])

    def test_directory_rejects_symlink_in_ancestor_and_traversal(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'real/sample').mkdir(parents=True)
            (root / 'alias').symlink_to(root / 'real')
            for path in [root / 'alias/sample', str(root) + '/../escape', 'relative/sample']:
                with self.assertRaises(helper.Refused), helper.directory(path): pass

    def test_shared_sandbox_policy_conflicts_and_hardlinks_fail_closed(self):
        for content in [b'[sandbox_workspace_write]\nwritable_roots=["/fictional/other/.git"]\n',
                        b'[sandbox_workspace_write]\nnetwork_access=true\n']:
            with self.fixture() as (root, workspace, home, _):
                file = home / '.codex/config.toml'
                file.write_bytes(content)
                with self.assertRaises(helper.Refused): self.prepare(root, home)
                self.assertEqual(file.read_bytes(), content)
                self.assertFalse((workspace / '.codex').exists())
        with self.fixture() as (root, workspace, home, _):
            original = root / 'keep'
            original.write_text('fictional protected bytes')
            os.link(original, home / '.codex/config.toml')
            with self.assertRaises(helper.Refused): self.prepare(root, home)
            self.assertEqual(original.read_text(), 'fictional protected bytes')

    def test_outside_group_refused_before_any_operation(self):
        with patch.object(helper, 'authorized', return_value=False), patch.object(helper, 'prepare') as prepare, patch.object(helper, 'doctor') as run:
            with self.assertRaisesRegex(helper.Refused, 'caller-group'):
                helper.dispatch({'operation': 'doctor', 'project': 'sample'}, 12345, 12345)
            prepare.assert_not_called()
            run.assert_not_called()
        with patch.object(helper.pwd, 'getpwnam', return_value=SimpleNamespace(pw_uid=1001)), patch.object(helper.os, 'getgrouplist', return_value=[9876]):
            self.assertFalse(helper.authorized(1002, 9876))
            self.assertTrue(helper.authorized(1001, 1234))
            self.assertTrue(helper.authorized(0, 0))

    def test_doctor_runs_as_agent_unit_with_controller_sandbox(self):
        with self.fixture() as (root, workspace, home, _):
            script = root / 'fixed-doctor.py'
            script.write_text('import time\ntime.sleep(5)\n')
            actual_popen = subprocess.Popen
            calls, stops = [], []
            def transient_unit(args, **options):
                calls.append((args, dict(options)))
                # The non-root test records the fixed systemd-run request, then
                # runs only the fixed doctor program as the test user.
                return actual_popen(args[args.index(sys.executable):], **options)
            with patch.object(helper, 'PYTHON', sys.executable), patch.object(helper, 'DOCTOR', str(script)), \
                 patch.object(helper, 'KILL_GRACE', 0), patch.object(helper.subprocess, 'Popen', side_effect=transient_unit), \
                 patch.object(helper.subprocess, 'run', side_effect=lambda args, **_: stops.append(args)):
                result = helper.doctor('sample', str(root / 'workspaces'), timeout=.05)
                self.assertEqual(result['category'], 'doctor-timeout')
                self.assertFalse(result['ok'])
                args, options = calls[0]
                unit = next(a for a in args if a.startswith('--unit='))[len('--unit='):]
                self.assertRegex(unit, r'^backroom-doctor-[0-9a-f]{12}$')
                self.assertEqual(stops, [[helper.SYSTEMCTL, 'kill', '--signal=SIGKILL', unit + '.service'],
                                         [helper.SYSTEMCTL, 'stop', unit + '.service']])
                self.assertEqual(args[0], helper.SYSTEMD_RUN)
                self.assertIn('--uid=agent', args)
                self.assertIn('--gid=backroom', args)
                self.assertIn('--wait', args)
                properties = [args[i + 1] for i, a in enumerate(args) if a == '-p']
                for value in helper.AGENT_SANDBOX:
                    self.assertIn(value, properties)
                self.assertIn('RuntimeMaxSec=0.05', properties)
                self.assertEqual(args[-6:], [sys.executable, '-I', '-u', str(script), '--workspace', str(workspace)])
                self.assertNotIn('user', options)
                self.assertNotIn('shell', options)
                script.write_text('print("FAIL bun — fix: install bun for the agent user")\nraise SystemExit(1)\n')
                result = helper.doctor('sample', str(root / 'workspaces'), timeout=2)
                self.assertFalse(result['ok'])
                self.assertEqual(result['output'], 'FAIL bun — fix: install bun for the agent user\n')
                script.write_text('print("PASS bun")\n')
                self.assertTrue(helper.doctor('sample', str(root / 'workspaces'), timeout=2)['ok'])
                script.write_text('print("x" * 20000)\n')
                self.assertEqual(helper.doctor('sample', str(root / 'workspaces'), timeout=2)['category'], 'doctor-output-limit')

    def test_doctor_sandbox_matches_agent_controllers(self):
        # Live 2026-11-08: the doctor ran in the root helper's namespace, and a
        # root service with NoNewPrivileges plus seccomp cannot drop to agent.
        nix = (ROOT / 'deploy/nixos/dev.nix').read_text()
        controller = nix.split('controller = name: after:', 1)[1].split('\nin {', 1)[0]
        expected = {
            'NoNewPrivileges=yes': 'NoNewPrivileges = true', 'PrivateDevices=yes': 'PrivateDevices = true',
            'ProtectSystem=strict': 'ProtectSystem = "strict"',
            'ReadWritePaths=/var/lib/backroom-agent /srv/backroom/workspaces /tmp':
                'ReadWritePaths = [ "/var/lib/backroom-agent" "/srv/backroom/workspaces" "/tmp" ]',
            'InaccessiblePaths=/srv/backroom/.secrets /srv/backroom/.switch-runtime /root /home/studio /run/docker.sock':
                'InaccessiblePaths = [ "/srv/backroom/.secrets" "/srv/backroom/.switch-runtime" "/root" "/home/studio" "/run/docker.sock" ]',
            'ProtectKernelTunables=yes': 'ProtectKernelTunables = true', 'ProtectKernelModules=yes': 'ProtectKernelModules = true',
            'ProtectControlGroups=yes': 'ProtectControlGroups = true', 'RestrictSUIDSGID=yes': 'RestrictSUIDSGID = true',
            'UMask=0007': 'UMask = "0007"',
        }
        self.assertEqual(sorted(helper.AGENT_SANDBOX), sorted(expected))
        for nix_line in expected.values():
            self.assertIn(nix_line, controller)
        self.assertIn('"/share/postgresql"', nix)

    def test_error_inside_pinned_directory_is_a_failure_not_a_path_refusal(self):
        # Live 2026-11-08: the service sandbox refused a setgid chmod, and the
        # helper reported it as unsafe-path, which hid the real cause.
        with self.fixture() as (root, workspace, home, _):
            with patch.object(helper.os, 'fchmod', side_effect=PermissionError(1, 'Operation not permitted')):
                with self.assertRaises(PermissionError):
                    self.prepare(root, home)

    def test_socket_reports_and_logs_failure_without_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = str(Path(temporary) / 'socket')
            with helper.Server(path, helper.Handler) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                errors = io.StringIO()
                try:
                    def fail(_slug):
                        raise PermissionError(1, 'Operation not permitted', '/srv/fictional/secret-path')
                    with patch.object(helper, 'authorized', return_value=True), patch.object(helper, 'prepare', side_effect=fail), patch.object(helper.sys, 'stderr', errors):
                        with socket.socket(socket.AF_UNIX) as connection:
                            connection.connect(path)
                            connection.sendall(b'{"operation":"prepare-builder","project":"sample"}\n')
                            data = json.loads(connection.recv(20000))
                finally:
                    server.shutdown()
                    thread.join()
                self.assertEqual(data, {'ok': False, 'category': 'provision-failed', 'output': ''})
                self.assertIn('PermissionError errno=1 at dispatch:', errors.getvalue())
                self.assertNotIn('/srv/fictional', errors.getvalue())

    def test_provision_unit_can_keep_setgid_workspace_modes(self):
        nix = (ROOT / 'deploy/nixos/dev.nix').read_text()
        provision = nix.split('systemd.services.backroom-provision', 1)[1]
        identity = nix.split('systemd.services.backroom-identity', 1)[1].split('systemd.services.', 1)[0]
        self.assertNotIn('RestrictSUIDSGID = true', provision)
        self.assertIn('RestrictSUIDSGID = true', identity)
        source = (ROOT / 'scripts/provision-helper.py').read_text()
        self.assertNotIn('S_ISUID', source)
        self.assertNotIn('0o4', source)

    def test_socket_uses_peer_credentials_and_bounds_input(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = str(Path(temporary) / 'socket')
            with helper.Server(path, helper.Handler) as server:
                thread = threading.Thread(target=server.serve_forever, daemon=True)
                thread.start()
                try:
                    with patch.object(helper, 'authorized', return_value=False):
                        with socket.socket(socket.AF_UNIX) as connection:
                            connection.connect(path)
                            connection.sendall(b'{"operation":"doctor","project":"sample"}\n')
                            data = json.loads(connection.recv(20000))
                        self.assertEqual(data['category'], 'caller-group')
                    with socket.socket(socket.AF_UNIX) as connection:
                        connection.connect(path)
                        connection.sendall(b'x' * 4097 + b'\n')
                        self.assertEqual(json.loads(connection.recv(20000))['category'], 'invalid-request')
                finally:
                    server.shutdown()
                    thread.join()

    def test_share_workspace_preserves_protected_config_and_sticky_parent(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            local = workspace / '.codex'
            local.mkdir(mode=0o750)
            config = local / 'config.toml'
            config.write_text('fictional protected config')
            config.chmod(0o640)
            workspace.chmod(0o3770)
            projects.share_workspace(workspace)
            self.assertEqual(stat.S_IMODE(config.stat().st_mode), 0o640)
            self.assertEqual(stat.S_IMODE(local.stat().st_mode), 0o750)
            self.assertEqual(stat.S_IMODE(workspace.stat().st_mode), 0o3770)

    def test_doctor_rejects_missing_writable_or_cross_project_policy(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            self.assertFalse(doctor.builder_policy(workspace))
            local = workspace / '.codex'
            local.mkdir(mode=0o750)
            config = local / 'config.toml'
            config.write_bytes(helper.builder_config(str(workspace)))
            config.chmod(0o640)
            workspace.chmod(0o3770)
            actual_lstat = Path.lstat
            def metadata(path):
                info = actual_lstat(path)
                owner = 0 if path in (local, config) else os.getuid() + 1
                return SimpleNamespace(st_mode=info.st_mode, st_uid=owner, st_nlink=info.st_nlink)
            with patch.object(Path, 'lstat', metadata), patch.object(doctor.os, 'access', return_value=False):
                self.assertTrue(doctor.builder_policy(workspace))
                config.write_text('[sandbox_workspace_write]\nwritable_roots=["/fictional/other/.git"]\nnetwork_access=true\n')
                self.assertFalse(doctor.builder_policy(workspace))
                config.write_bytes(helper.builder_config(str(workspace)))
                config.chmod(0o660)
                self.assertFalse(doctor.builder_policy(workspace))

    def test_nixos_service_is_hardened_and_ordered_before_studio(self):
        source = (ROOT / 'deploy/nixos/dev.nix').read_text()
        service = source.split('systemd.services.backroom-provision = {', 1)[1]
        for expected in ['before = [ "backroom-studio.service" ]', 'User = "root"', 'Group = "backroom"',
                         'ProtectSystem = "strict"', 'NoNewPrivileges = true', 'CAP_SETUID', 'CAP_SETGID',
                         '/srv/backroom/scripts/provision-helper.py', '/var/lib/backroom-agent/.codex']:
            self.assertIn(expected, service)
        self.assertIn('"backroom-provision.service"', source.split('systemd.services.backroom-studio = {', 1)[1].split('serviceConfig', 1)[0])


if __name__ == '__main__':
    unittest.main(verbosity=2)
