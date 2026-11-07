"""Offline regression tests. Only fictional fixtures and fake processes run."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import signal
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('studio_move', ROOT / 'scripts/studio_move.py')
move = importlib.util.module_from_spec(spec)
spec.loader.exec_module(move)
spec = importlib.util.spec_from_file_location('studio_ssh', ROOT / 'scripts/studio-ssh.py')
router = importlib.util.module_from_spec(spec)
spec.loader.exec_module(router)
spec = importlib.util.spec_from_file_location('studio_verify', ROOT / 'scripts/studio-verify.py')
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)
spec = importlib.util.spec_from_file_location('shadow_tests', ROOT / 'scripts/repro/test-shadow-git.py')
shadow_tests = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shadow_tests)
ShadowTests = shadow_tests.ShadowTests
spec = importlib.util.spec_from_file_location('broker', ROOT / 'scripts/studio-deploy-broker.py')
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)


def write(root, name, content='fictional-secret-sentinel-87c4'):
    file = root / name
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(content)
    return file


def wait_for(predicate, timeout=8):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate(): return
        time.sleep(.05)
    raise AssertionError('fake process condition timed out')


class MoveTests(unittest.TestCase):
    def test_allowlist_is_exact_and_never_grows(self):
        self.assertEqual(move.SECRETS, ('switch.env', 'discord.env', 'block1-credentials.json',
            'real-stage-credentials.json', 'studio-door-webhook', 'backroom-demo-ip.txt',
            'spike-state.json', 'keys-signing-key', 'projects'))
        self.assertEqual(move.CONTROLLERS, {'block1-lead-controller': 'lead', 'real-build-controller': 'build'})

    def test_payload_excludes_every_nonallowlisted_secret(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name in move.SECRETS[:-1]: write(root, '.secrets/' + name)
            write(root, '.secrets/projects/sample/door.key')
            write(root, '.secrets/projects/sample/deploy.pem')
            write(root, '.secrets/projects/sample/deploy.PEM')
            write(root, '.secrets/projects/sample/provider-state.json')
            write(root, '.secrets/projects/sample/console-profile.bak')
            for name in ('private.pem', 'console-profile/file', 'provider-state/file', 'other.json'):
                write(root, '.secrets/' + name)
            for source, target in move.CONTROLLERS.items():
                for name in ('controller.db', 'agents/live/config.json', 'secrets/auth', 'watchers/current.json', 'agents/archived-sessions/session.json', 'provider-state/token', 'unknown'):
                    write(root, '.secrets/' + source + '/' + name)
            write(root, '.switch-runtime/block1.json', '{}')
            write(root, '.switch-runtime/projects/sample.json', '{}')
            write(root, '.switch-runtime/project-state/sample/desk.sqlite')
            write(root, '.switch-runtime/retired/private.json')
            write(root, 'workspaces/sample/src/app.ts', '// fictional sample')
            write(root, 'workspaces/sample/.env', 'fictional dotenv sentinel')
            write(root, 'workspaces/sample/.env.required', 'SAMPLE_KEY\n')
            write(root, 'workspaces/sample/node_modules/fake/index.js')
            (root / 'workspaces/sample/node_modules/link').symlink_to(root / '.secrets')
            output = root / 'payload.tar'
            buffer = io.StringIO()
            with contextlib.redirect_stdout(buffer), contextlib.redirect_stderr(buffer):
                move.pack_payload(root, output)
            self.assertEqual(buffer.getvalue(), '')
            with tarfile.open(output) as archive:
                names = archive.getnames()
            expected = {'.secrets/' + n for n in move.SECRETS[:-1]}
            expected |= {'.secrets/projects/sample/door.key', '.switch-runtime/block1.json', '.switch-runtime/projects/sample.json', '.switch-runtime/project-state/sample/desk.sqlite', 'workspaces/sample/src/app.ts', 'workspaces/sample/.env.required'}
            expected |= {'controllers/' + target + '/' + n for target in ('lead', 'build') for n in ('controller.db', 'agents/live/config.json', 'secrets/auth', 'watchers/current.json')}
            self.assertEqual(set(names), expected)

    def test_server_archive_validation_rejects_allowlist_escape(self):
        for name in ('.secrets/other.json', '../escape', '/root/key',
                     'controllers/other/controller.db', 'controllers/lead/provider-state.json',
                     '.switch-runtime/retired/private.json', 'workspaces/sample/.env',
                     '.secrets/switch.env/nested'):
            self.assertFalse(move.allowed_payload_path(Path(name)), name)
        for name in ('.secrets/switch.env', '.secrets/spike-state.json', '.secrets/keys-signing-key', '.secrets/projects/sample/door.key',
                     'controllers/lead/controller.db', 'controllers/build/watchers/active.json',
                     '.switch-runtime/projects/sample.json', 'workspaces/sample/src/app.ts'):
            self.assertTrue(move.allowed_payload_path(Path(name)), name)

    def test_symlinks_are_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            write(root, 'outside/fake')
            (root / '.secrets').mkdir()
            (root / '.secrets/projects').symlink_to(root / 'outside', target_is_directory=True)
            with self.assertRaises(ValueError): list(move.payload_files(root))

    def test_import_replaces_studio_trees_before_copying_planted_destination_links(self):
        for linked_root in (False, True):
            with self.subTest(linked_root=linked_root), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                server = root / 'server'; server.mkdir()
                home = root / 'agent-home'; home.mkdir()
                stage = root / 'payload'; stage.mkdir()
                broker_file = write(root, 'protected/broker.py', 'fictional root broker')
                secret_file = write(root, 'protected/env', 'fictional root env')
                write(stage, '.switch-runtime/studio.json', '{"workspace":"/old/workspaces/sample"}')
                write(stage, '.secrets/projects/sample/door.key', 'fictional incoming key')
                write(stage, '.secrets/switch.env', 'fictional incoming env')
                write(stage, 'controllers/lead/watchers/current.json', '{"path":"/old/file"}')
                executable = write(stage, 'workspaces/sample/run.sh', '#!/bin/sh\nexit 0\n')
                executable.chmod(0o700)
                old_inodes = {}
                for sub, name, victim in (('.switch-runtime', 'studio.json', broker_file),
                                          ('.secrets', 'switch.env', secret_file)):
                    target = server / sub
                    old = root / ('old-' + sub) if linked_root else target
                    old.mkdir(mode=0o770)
                    if linked_root:
                        target.symlink_to(old, target_is_directory=True)
                    (old / name).symlink_to(victim)
                    old_inodes[sub] = target.lstat().st_ino
                # Also retain the earlier controller/workspace replacement rule.
                write(home, 'lead/old', 'fictional stale controller')
                write(server, 'workspaces/old', 'fictional stale workspace')
                copied = set()
                handed_over = set()
                copy = shutil.copyfile
                def private_copy(source, destination, **kwargs):
                    destination = Path(destination)
                    for sub in ('.secrets', '.switch-runtime', 'workspaces'):
                        target = server / sub
                        if destination.is_relative_to(target):
                            self.assertNotIn(sub, handed_over)
                            self.assertFalse(target.is_symlink())
                            self.assertEqual(target.stat().st_mode & 0o777, 0o700)
                            if sub in old_inodes:
                                self.assertNotEqual(target.lstat().st_ino, old_inodes[sub])
                            copied.add(sub)
                    return copy(source, destination, **kwargs)
                def chown(path, uid, gid):
                    path = Path(path)
                    for sub in ('.secrets', '.switch-runtime', 'workspaces'):
                        if path == server / sub and uid == 10001:
                            handed_over.add(sub)
                with patch.object(move, 'REMOTE', str(server)), \
                     patch.object(move, 'AGENT_HOME', home), \
                     patch.object(move, 'IMPORT_BACKUPS', root / 'backups'), \
                     patch.object(move, 'SWITCH_ENV', root / 'protected/switch.env'), \
                     patch('pwd.getpwnam', side_effect=lambda name: SimpleNamespace(pw_uid=10001 if name == 'studio' else 10002)), \
                     patch('grp.getgrnam', return_value=SimpleNamespace(gr_gid=10003)), \
                     patch.object(move.os, 'chown', side_effect=chown), \
                     patch.object(move.shutil, 'copyfile', side_effect=private_copy), \
                     contextlib.redirect_stdout(io.StringIO()):
                    move.install_payload(stage, '/old')
                self.assertEqual(copied, {'.secrets', '.switch-runtime', 'workspaces'})
                self.assertEqual(handed_over, copied)
                self.assertEqual(broker_file.read_text(), 'fictional root broker')
                self.assertEqual(secret_file.read_text(), 'fictional root env')
                self.assertEqual(json.loads((server / '.switch-runtime/studio.json').read_text()),
                                 {'workspace': str(server / 'workspaces/sample')})
                self.assertEqual((server / '.secrets/switch.env').read_text(), 'fictional incoming env')
                self.assertEqual((root / 'protected/switch.env').stat().st_mode & 0o777, 0o600)
                self.assertEqual((server / 'workspaces/sample/run.sh').stat().st_mode & 0o777, 0o770)
                self.assertFalse((server / 'workspaces/old').exists())
                self.assertFalse((home / 'lead/old').exists())

    def make_cutover_fixture(self, root):
        (root / '.switch-runtime').mkdir(exist_ok=True)
        for name in move.SECRETS[:-1]: write(root, '.secrets/' + name)
        for name in move.CONTROLLERS: write(root, '.secrets/' + name + '/controller.db')

    def test_missing_allowlisted_file_stops_before_laptop_mutation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_cutover_fixture(root)
            (root / '.secrets/spike-state.json').unlink()
            with patch.object(move, 'ssh', return_value=b''), patch.object(move, 'stop_laptop') as stop:
                with self.assertRaises(RuntimeError): move.cutover(root, {})
                stop.assert_not_called()

    def test_repeat_cutover_does_not_overwrite_imported_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_cutover_fixture(root)
            calls = []
            with patch.object(move, 'ssh', side_effect=lambda command: calls.append(command) or b''), patch.object(move, 'stop_laptop') as stop, patch.object(move, 'pack_payload') as pack, contextlib.redirect_stdout(io.StringIO()):
                position = {'phase':'imported'}
                move.cutover(root, position)
                stop.assert_called_once_with(root)
                pack.assert_not_called()
                self.assertEqual(position['phase'], 'complete')
            self.assertEqual([c for c in calls if c.startswith('systemctl start ')], ['systemctl start ' + n for n in move.UNITS])
            self.assertFalse(any('docker run' in c for c in calls))
            self.assertFalse(any('agent_definitions' in c for c in calls))

    def test_fresh_cutover_needs_no_definition_rewrite_checkpoint(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_cutover_fixture(root)
            calls = []
            def remote(command, **kwargs):
                calls.append(command)
                return b''
            def local(args, **kwargs):
                calls.append(args)
                return b''
            with patch.object(move, 'ssh', side_effect=remote), patch.object(move, 'run', side_effect=local), patch.object(move, 'stop_laptop', side_effect=lambda _: calls.append('laptop stopped')), patch.object(move.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)), contextlib.redirect_stdout(io.StringIO()):
                position = {}
                move.cutover(root, position)
            self.assertEqual(position['phase'], 'complete')
            self.assertLess(calls.index('laptop stopped'), calls.index('systemctl start backroom-switch'))
            self.assertTrue(any(isinstance(c, str) and 'studio_move.py _install' in c for c in calls))
            self.assertFalse(any('agent_definitions' in str(c) or 'provisioning-reviewed' in str(c) for c in calls))

    def test_bundle_updates_existing_server_without_public_remote(self):
        # Disposable fictional Git history only; never commit the project repo.
        import shlex
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / 'laptop'
            server = Path(temporary) / 'server'
            root.mkdir(); server.mkdir()
            def git(*args):
                return move.run(['git', *args], cwd=root)
            git('init', '-q')
            def checkpoint(message):
                git('add', '.')
                git('-c', 'user.name=Sample', '-c', 'user.email=sample@example.invalid',
                    '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', message)
                return git('rev-parse', 'HEAD').strip()
            write(root, 'source.txt', 'fictional first revision')
            write(root, 'removed.txt', 'fictional removed file')
            first = checkpoint('fictional first checkpoint')
            calls = []
            def fake_ssh(command, **kwargs):
                calls.append(command)
                self.assertNotIn('runuser',command)
                command=command.replace('/var/lib/backroom',str(server.parent / 'protected')).replace('/srv/backroom',str(server))
                # Owner/group creation is live-only; exercise the actual Git flow.
                command=command.replace('install -d -m 750 -o root -g backroom','mkdir -p')
                return move.run(['bash','-c',command], **kwargs)
            with patch.object(move, 'ssh', side_effect=fake_ssh):
                move.transfer_commit(root)
                self.assertEqual(move.run(['git', '--git-dir='+str(server.parent / 'protected/source.git'), 'rev-parse', 'HEAD'], cwd=server).strip(), first)
                # Dirty source overlays and protected runtime files survive an
                # ordinary prepare, while a newer HEAD replaces tracked source.
                write(server, 'source.txt', 'fictional old overlay')
                attack=write(server.parent,'attack.sh','#!/bin/sh\ntouch '+str(server.parent/'SOURCE_ATTACK_EXECUTED')+'\n')
                attack.chmod(0o700)
                write(server,'.git/config','[core]\n fsmonitor = '+str(attack)+'\n')
                outside=server.parent/'outside';outside.mkdir()
                (server/'agent-link').symlink_to(outside,target_is_directory=True)
                write(server, '.secrets/keep', 'fictional protected state')
                write(root, 'source.txt', 'fictional next revision')
                (root / 'removed.txt').unlink()
                second = checkpoint('fictional next checkpoint')
                for _ in range(2):
                    move.transfer_commit(root)
                    self.assertEqual(move.run(['git', '--git-dir='+str(server.parent / 'protected/source.git'), 'rev-parse', 'HEAD'], cwd=server).strip(), second)
                    self.assertEqual((server / 'source.txt').read_text(), 'fictional next revision')
                    self.assertFalse((server / 'removed.txt').exists())
                    self.assertTrue((server / '.secrets/keep').exists())
                    self.assertFalse((server / '.git/studio-source.bundle').exists())
                    self.assertFalse((server.parent/'SOURCE_ATTACK_EXECUTED').exists())
                    self.assertFalse((server/'agent-link').exists())
                    self.assertEqual(list(outside.iterdir()),[])
            self.assertTrue(all('origin' not in c and 'github.com' not in c for c in calls))

    def test_studio_up_only_restarts_server_supervisor(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'scripts').mkdir()
            shutil.copy2(ROOT / 'scripts/studio-up.sh', root / 'scripts/studio-up.sh')
            fake = write(root, 'bin/ssh', '#!/bin/sh\nprintf "%s\\n" "$@"\n')
            fake.chmod(0o700)
            result = subprocess.run(['bash', str(root / 'scripts/studio-up.sh')], capture_output=True,
                text=True, env={**os.environ, 'PATH':str(fake.parent) + ':' + os.environ['PATH']})
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout.splitlines(), ['-o', 'BatchMode=yes', 'backroom-dev', 'systemctl restart backroom-studio'])
            self.assertFalse((root / '.switch-runtime').exists())

    def test_rollback_refuses_second_gateway_when_dev_stop_fails(self):
        with patch.object(move, 'ssh', side_effect=RuntimeError('fictional failure')), patch.object(move, 'run') as run:
            with self.assertRaises(RuntimeError): move.rollback(Path('/fictional'), {})
            run.assert_not_called()

    def test_literal_json_and_sqlite_rewrite(self):
        old = '/home/fictional/backroom'
        fixture = {'workspace': old + '/workspaces/sample', 'nested': [old + '/.secrets/block1-lead-controller'], 'opaque': 'fictional-secret'}
        result = move.rewrite(fixture, old)
        self.assertEqual(result['workspace'], '/srv/backroom/workspaces/sample')
        self.assertEqual(result['nested'], ['/var/lib/backroom-agent/lead'])
        self.assertEqual(result['opaque'], 'fictional-secret')
        with tempfile.TemporaryDirectory() as temporary:
            file = Path(temporary) / 'controller.db'
            with sqlite3.connect(file) as db:
                db.execute('CREATE TABLE config (value TEXT, raw BLOB, number INTEGER)')
                db.execute('INSERT INTO config VALUES (?, ?, ?)', (json.dumps(fixture), b'opaque', 7))
            move.rewrite_sqlite(file, old)
            with sqlite3.connect(file) as db:
                value, raw, number = db.execute('SELECT * FROM config').fetchone()
            self.assertEqual(json.loads(value), result)
            self.assertEqual((raw, number), (b'opaque', 7))

    def test_failure_output_does_not_echo_native_diagnostics(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'scripts').mkdir()
            shutil.copy2(ROOT / 'scripts/studio_move.py', root / 'scripts/studio_move.py')
            fake = write(root, 'bin/ssh', '#!/bin/sh\necho fictional-secret-sentinel-87c4\necho fictional-secret-sentinel-87c4 >&2\nexit 1\n')
            fake.chmod(0o700)
            result = subprocess.run([sys.executable, str(root / 'scripts/studio_move.py'), 'verify'], capture_output=True, text=True, env={**os.environ, 'PATH':str(fake.parent) + ':' + os.environ['PATH']})
            self.assertEqual(result.returncode, 1)
            self.assertEqual(result.stdout, 'studio move: failed; details withheld; see docs/STUDIO-SERVER.md\n')
            self.assertEqual(result.stderr, '')

    def test_login_help_does_not_consult_credentials(self):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer): move.login_help()
        self.assertEqual(len(buffer.getvalue().splitlines()), 3)
        self.assertIn('claude auth login', buffer.getvalue())
        self.assertIn('codex login --device-auth', buffer.getvalue())
        self.assertNotIn('.secrets', buffer.getvalue())

    def test_controller_verifier_uses_live_leases_and_never_owner_login(self):
        calls = []
        def fake(args, **kwargs):
            calls.append((args, kwargs))
            return subprocess.CompletedProcess(args, 0, stdout='t\n', stderr='')
        self.assertTrue(verifier.controller_connected("SAMPLE-controller'", runner=fake))
        args, options = calls[0]
        self.assertEqual(args[-1], "SAMPLE-controller'")
        self.assertNotIn("SAMPLE-controller'", options['input'])
        self.assertIn("c.id = :'controller_id'", options['input'])
        self.assertIn('p.stopped_at IS NULL', options['input'])
        self.assertIn("interval '15 seconds'", options['input'])
        self.assertIn('c.disconnected_at IS NULL', options['input'])
        self.assertNotIn('lead_session', options['input'])
        def offline(args, **kwargs):
            return subprocess.CompletedProcess(args, 0, stdout='f\n', stderr='')
        self.assertFalse(verifier.controller_connected('SAMPLE-controller', runner=offline))

    def test_definition_check_ignores_stopped_retired_and_reports_names_only(self):
        fake_home = str(Path("/" + "home") / "fictional")
        old = str(Path(fake_home) / "laptop's backroom")
        # Execute the read-only predicate against fictional SQLite rows. Only
        # Postgres's output encoding and psql variable syntax are translated.
        with sqlite3.connect(':memory:') as db:
            db.create_function('strpos', 2, lambda value, needle: value.find(needle) + 1)
            db.execute('CREATE TABLE agents (id TEXT, tenant_id TEXT, name TEXT)')
            db.execute('CREATE TABLE agent_definitions (agent_id TEXT, tenant_id TEXT, desired_state TEXT, definition TEXT)')
            fixtures = [('retired-lead', 'stopped', {'directory':old}),
                        ('stopped-builder', 'stopped', {'instructions':'Work at ' + old}),
                        ('server-lead', 'running', {'directory':'/srv/backroom/workspaces/sample'}),
                        ('bad-builder', 'running', {'directory':old + '/workspaces/sample'}),
                        ('bad-instructions', 'running', {'directory':'/srv/backroom', 'instructions':old + '/studio-kit'}),
                        ('bad-tools', 'running', {'instructions':'Use ' + fake_home + '/.codex/skills/sample'}),
                        ('server-home', 'running', {'instructions':'Keep out of /home/studio'})]
            for name, state, definition in fixtures:
                db.execute('INSERT INTO agents VALUES (?, ?, ?)', (name, 'sample', name))
                db.execute('INSERT INTO agent_definitions VALUES (?, ?, ?, ?)', (name, 'sample', state, json.dumps(definition)))
            def fake(args, **kwargs):
                self.assertEqual(args[-2:], [old, fake_home + '/'])
                self.assertNotIn(old, kwargs['input'])
                sql = kwargs['input'].replace('to_json(a.name)::text', 'a.name').replace(":'laptop_root'", '?').replace(":'laptop_home'", '?')
                names = [name for (name,) in db.execute(sql, (old, fake_home + '/'))]
                return subprocess.CompletedProcess(args, 0, stdout='\n'.join(json.dumps(n) for n in names), stderr='fictional private diagnostics')
            output = io.StringIO()
            with contextlib.redirect_stdout(output), self.assertRaises(RuntimeError):
                verifier.check_definition_paths(old, runner=fake)
            self.assertEqual(output.getvalue(), 'agent definition: "bad-builder"\nagent definition: "bad-instructions"\nagent definition: "bad-tools"\nrunning agent definition paths: FAILED\n')
            # Retired/stopped definitions keep laptop paths without failing.
            db.execute("UPDATE agent_definitions SET desired_state='stopped' WHERE agent_id LIKE 'bad-%'")
            with contextlib.redirect_stdout(io.StringIO()):
                verifier.check_definition_paths(old, runner=fake)
            self.assertEqual(db.execute("SELECT definition FROM agent_definitions WHERE agent_id='retired-lead'").fetchone()[0], json.dumps({'directory':old}))

    def test_verifier_forwards_only_offending_names_on_failure(self):
        result = subprocess.CompletedProcess([], 1, stdout='agent definition: "sample-builder"\nfictional-private-value\n', stderr='fictional-private-value')
        output = io.StringIO()
        with patch.object(move.subprocess, 'run', return_value=result), contextlib.redirect_stdout(output), self.assertRaises(RuntimeError):
            move.verify()
        self.assertEqual(output.getvalue(), 'agent definition: "sample-builder"\n')

    def test_ssh_router_keeps_deploy_key_at_root(self):
        args = ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '--', 'root@192.0.2.10', "exec 'backroom-env' 'check' 'sample' 'KEY'"]
        routed = router.route(args, '192.0.2.10')
        import shlex
        self.assertEqual(shlex.split(routed[-1]), [router.SSH, *args])
        self.assertEqual(routed[-2], 'backroom-dev')
        self.assertEqual(router.route(['backroom-dev', 'true'], '192.0.2.10'), [router.SSH, 'backroom-dev', 'true'])

    def test_nixos_security_and_service_contract(self):
        text = (ROOT / 'deploy/nixos/dev.nix').read_text()
        for name in ('studio', 'agent'):
            user = text.split('users.users.' + name + ' = {', 1)[1].split('};', 1)[0]
            self.assertIn('isSystemUser = true', user)
            self.assertIn('group = "backroom"', user)
            self.assertIn('homeMode = "0700"', user)
            self.assertNotIn('extraGroups', user)
        for rule in ('d /srv/backroom/.secrets 0700 studio', 'd /srv/backroom/.switch-runtime 0700 studio',
                     'd /srv/backroom/workspaces 2770 studio backroom', 'd /var/lib/backroom-agent 0700 agent'):
            self.assertIn(rule, text)
        for path in ('/root', '/home/studio', '/srv/backroom/.secrets', '/srv/backroom/.switch-runtime', '/run/docker.sock'):
            self.assertIn('"' + path + '"', text)
        self.assertIn('programs.nix-ld.enable = true', text)
        self.assertIn('virtualisation.docker.enable = true', text)
        self.assertIn('p.requests p.pyyaml', text)
        self.assertIn('/srv/backroom/workspaces/*', text)
        self.assertIn('--uid-owner studio -d 169.254.169.254 -j REJECT', text)
        self.assertIn('--uid-owner studio -d fd00:ec2::254 -j REJECT', text)
        self.assertIn('--uid-owner agent -d 169.254.169.254 -j REJECT', text)
        self.assertIn('--uid-owner agent -d fd00:ec2::254 -j REJECT', text)
        self.assertEqual(text.count('--uid-owner agent -p tcp --dport 5432 -j REJECT'), 4)
        self.assertEqual(text.count('Restart = "always"'), 3) # controller factory creates two units
        self.assertNotIn('wheel"', text)
        self.assertNotIn('extraGroups', text)
        installer = (ROOT / 'scripts/studio-install-tools.sh').read_text()
        self.assertIn('@anthropic-ai/claude-code@2.1.319', installer)
        self.assertIn('@openai/codex@0.167.0', installer)
        self.assertIn('chmod -R a+rX,go-w', installer)

    def test_broker_planted_shell_metacharacter_traversal_and_unknown_commands(self):
        import shlex
        host='root@192.0.2.10'
        good=['python3','scripts/entry.py','begin','sample','a'*64]
        def command(args): return 'cd /var/lib/backroom/fleet && exec '+shlex.join(args)
        self.assertEqual(broker.parse(command(good),host),[broker.BIN+'python3',*good[1:]])
        with tempfile.TemporaryDirectory() as temporary:
            marker=Path(temporary)/'ROOT_ATTACK_EXECUTED'
            attacks=[command(['sh','-c','touch '+str(marker)]),
                     command(['python3','scripts/entry.py','begin','sample;touch '+str(marker),'a'*64]),
                     command(['python3','scripts/../scripts/entry.py','begin','sample','a'*64]),
                     command(good)+'; touch '+str(marker),
                     command(['cat','hosts/../../etc/shadow']),
                     'systemctl restart backroom-studio',
                     'true']
            for attack in attacks:
                with self.assertRaises(ValueError,msg=attack): broker.parse(attack,host)
                # Exercise the forced-command entry point too. An accidental
                # shell/exec before validation would leave the planted marker.
                with patch.dict(os.environ,{'SSH_ORIGINAL_COMMAND':attack}), patch.object(broker,'deploy_host',return_value=host), patch.object(broker.os,'execve',side_effect=lambda *_:marker.write_text('executed')) as execute:
                    with self.assertRaises(ValueError): broker.main()
                    execute.assert_not_called()
            self.assertFalse(marker.exists())

    def test_broker_fixed_refusal_categories_and_exit_codes(self):
        import shlex
        command = 'cd ' + str(broker.FLEET) + ' && exec ' + shlex.join(['cat', 'hosts/settings.json'])
        cases = [
            (broker.Refusal('untrusted-tree'), 'untrusted-tree'),
            (broker.Refusal('bad-host'), 'bad-host'),
        ]
        for error, category in cases:
            output = io.StringIO()
            with patch.object(broker, 'deploy_host', side_effect=error), contextlib.redirect_stderr(output):
                self.assertEqual(broker.cli(), 77)
            self.assertEqual(output.getvalue(), 'Deployment broker: ' + category + '\n')
        for attack in ['true', "cd 'unterminated", command + '; fictional-private-value']:
            output = io.StringIO()
            with patch.object(broker, 'deploy_host', return_value='root@192.0.2.10'), patch.dict(os.environ, {'SSH_ORIGINAL_COMMAND': attack}), contextlib.redirect_stderr(output):
                self.assertEqual(broker.cli(), 77)
            self.assertEqual(output.getvalue(), 'Deployment broker: refused-operation\n')
        with patch.object(broker, 'main', side_effect=OSError('fictional-private-path')), contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(broker.cli(), 1)
        self.assertEqual(output.getvalue(), 'Deployment broker: failed\n')

    def test_broker_exact_no_link_build_grammar(self):
        import shlex
        host = 'root@192.0.2.10'
        target = 'path:' + str(broker.FLEET) + '#nixosConfigurations.deploy.config.system.build.toplevel'
        good = ['nix', 'build', '--no-link', '--no-write-lock-file', target]
        def command(args): return 'cd ' + str(broker.FLEET) + ' && exec ' + shlex.join(args)
        self.assertEqual(broker.parse(command(good), host), [broker.BIN + 'nix', *good[1:]])
        attacks = [
            ['nixos-rebuild', 'build', '--flake', 'path:' + str(broker.FLEET) + '#deploy', '--no-write-lock-file'],
            ['nix', 'build', '--no-write-lock-file', target],
            ['nix', 'build', '--no-link', target],
            good + ['--out-link', 'result'],
            good[:-1] + [target + '.evil'],
            good[:-1] + [target.replace('.deploy.', '.other.')],
        ]
        for args in attacks:
            with self.assertRaises(broker.Refusal) as error: broker.parse(command(args), host)
            self.assertEqual(error.exception.category, 'refused-operation')

    def test_broker_real_tree_refuses_result_and_no_link_sequence_stays_trusted(self):
        # Run the real parser, walk, lstat symlink check and execve in children.
        # The laptop user cannot create root-owned fixtures. Adapt only ownership
        # and ancestor permissions; all fixture modes and file types stay real.
        import shlex
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            fleet = root / 'fleet'
            write(fleet, 'hosts/settings.json', json.dumps({'deployIp': '192.0.2.10'}))
            fake_nix = write(root, 'bin/nix', '#!' + sys.executable + '\n' +
                "import json,pathlib,sys\n" +
                "args=sys.argv[1:]\n" +
                "with open('nix-calls.jsonl','a') as out: out.write(json.dumps(args)+'\\n')\n" +
                "if '--no-link' not in args: pathlib.Path('result').symlink_to('/nix/store/fictional-closure')\n")
            fake_nix.chmod(0o700)
            fake_cat = write(root, 'bin/cat', '#!' + sys.executable + '\n' +
                "import pathlib,sys\nsys.stdout.write(pathlib.Path(sys.argv[1]).read_text())\n")
            fake_cat.chmod(0o700)
            driver = r"""
import importlib.util,os,pathlib,sys
from types import SimpleNamespace
spec=importlib.util.spec_from_file_location('broker',sys.argv[1])
broker=importlib.util.module_from_spec(spec);spec.loader.exec_module(broker)
root=pathlib.Path(sys.argv[2]);broker.FLEET=root/'fleet';broker.BIN=str(root/'bin')+'/'
original=pathlib.Path.lstat
def fixture_lstat(path,*args,**kwargs):
    info=original(path,*args,**kwargs)
    if path==root or root in path.parents:
        return SimpleNamespace(st_uid=0,st_mode=info.st_mode)
    if path in root.parents:
        return SimpleNamespace(st_uid=0,st_mode=info.st_mode & ~0o022)
    return info
pathlib.Path.lstat=fixture_lstat
os.environ['SSH_ORIGINAL_COMMAND']=sys.argv[3]
raise SystemExit(broker.cli())
"""
            def run(args):
                command = 'cd ' + shlex.quote(str(fleet)) + ' && exec ' + shlex.join(args)
                return subprocess.run([sys.executable, '-I', '-c', driver, str(ROOT / 'scripts/studio-deploy-broker.py'), str(root), command], capture_output=True, text=True)
            # Both builds emitted by NixDeployer use the same no-link flags.
            for target in ['sample', 'nixosConfigurations.deploy.config.system.build.toplevel']:
                result = run(['nix', 'build', '--no-link', '--no-write-lock-file', 'path:' + str(fleet) + '#' + target])
                self.assertEqual((result.returncode, result.stdout, result.stderr), (0, '', ''))
                self.assertFalse(any(path.is_symlink() for path in fleet.rglob('*')))
                read = run(['cat', 'hosts/settings.json'])
                self.assertEqual(read.returncode, 0, read.stderr)
            calls = [json.loads(line) for line in (fleet / 'nix-calls.jsonl').read_text().splitlines()]
            self.assertEqual(len(calls), 2)
            self.assertTrue(all(args[:3] == ['build', '--no-link', '--no-write-lock-file'] for args in calls))
            # The real dangling symlink poisons every later broker call.
            (fleet / 'result').symlink_to('/nix/store/fictional-closure')
            read = run(['cat', 'hosts/settings.json'])
            self.assertEqual((read.returncode, read.stdout, read.stderr), (77, '', 'Deployment broker: untrusted-tree\n'))
            (fleet / 'result').unlink()
            self.assertEqual(run(['cat', 'hosts/settings.json']).returncode, 0)
            # Permission and host validation still fail closed.
            settings = fleet / 'hosts/settings.json'
            settings.chmod(0o666)
            self.assertEqual(run(['cat', 'hosts/settings.json']).stderr, 'Deployment broker: untrusted-tree\n')
            settings.chmod(0o600)
            settings.write_text(json.dumps({'deployIp': 'fictional-private-invalid-host'}))
            bad = run(['cat', 'hosts/settings.json'])
            self.assertEqual((bad.returncode, bad.stdout, bad.stderr), (77, '', 'Deployment broker: bad-host\n'))

    def test_broker_ssh_adapter_reports_bad_host_and_preserves_refusal_exit(self):
        # No real credential path or SSH is read or executed.
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            ip = write(root, 'deploy-ip', '999.1.2.3')
            output = io.StringIO()
            with patch.object(router, 'Path', return_value=ip), patch.object(router.os, 'execv') as execute, contextlib.redirect_stderr(output):
                self.assertEqual(router.main(), 77)
                execute.assert_not_called()
            self.assertEqual(output.getvalue(), 'Deployment broker: bad-host\n')
            ip.write_text('192.0.2.10')
            fake = write(root, 'ssh', '#!' + sys.executable + '\nimport sys\nsys.stderr.write("Deployment broker: untrusted-tree\\n")\nsys.exit(77)\n')
            fake.chmod(0o700)
            driver = """
import importlib.util,pathlib,sys
spec=importlib.util.spec_from_file_location('router',sys.argv[1])
router=importlib.util.module_from_spec(spec);spec.loader.exec_module(router)
ip=pathlib.Path(sys.argv[2]);router.Path=lambda _:ip;router.SSH=sys.argv[3]
sys.argv=['studio-ssh','backroom-dev','fictional-command']
raise SystemExit(router.main())
"""
            child = subprocess.run([sys.executable, '-I', '-c', driver, str(ROOT / 'scripts/studio-ssh.py'), str(ip), str(fake)], capture_output=True, text=True)
            self.assertEqual((child.returncode, child.stdout, child.stderr), (77, '', 'Deployment broker: untrusted-tree\n'))

    def test_installer_revokes_old_unrestricted_localhost_keys(self):
        installer=(ROOT/'scripts/studio-install-tools.sh').read_text()
        code=installer.split("<<'KEYS'\n",1)[1].split('\nKEYS',1)[0]
        with tempfile.TemporaryDirectory() as temporary:
            root=Path(temporary)
            home=root/'home';(home/'.ssh').mkdir(parents=True)
            admin=root/'root';(admin/'.ssh').mkdir(parents=True)
            (home/'.ssh/dev-root.pub').write_text('ssh-ed25519 SAMPLE_PUBLIC_NEW studio\n')
            authorized=admin/'.ssh/authorized_keys'
            authorized.write_text('from="127.0.0.1",no-port-forwarding ssh-ed25519 SAMPLE_PUBLIC_OLD\nssh-ed25519 SAMPLE_PUBLIC_NEW studio\nssh-ed25519 SAMPLE_OWNER_ADMIN owner\n')
            code=code.replace('/home/studio',str(home)).replace('/root/.ssh',str(admin/'.ssh'))
            child=subprocess.run(['python3','-I','-c',code],capture_output=True,text=True)
            self.assertEqual(child.returncode,0,child.stderr)
            lines=authorized.read_text().splitlines()
            self.assertEqual(len(lines),2)
            self.assertEqual(lines[0],'ssh-ed25519 SAMPLE_OWNER_ADMIN owner')
            self.assertIn('restrict,from="127.0.0.1",command=',lines[1])
            self.assertIn('studio-deploy-broker.py',lines[1])
            self.assertNotIn('SAMPLE_PUBLIC_OLD',authorized.read_text())
        self.assertIn('runuser -u studio -- python3 -I',installer)
        self.assertNotIn('chown studio:backroom /home/studio/.ssh/{config',installer)

    def test_root_service_never_executes_a_studio_writable_artifact(self):
        text=(ROOT/'deploy/nixos/dev.nix').read_text()
        switch=text.split('systemd.services.backroom-switch = {',1)[1].split('systemd.services.backroom-controller',1)[0]
        self.assertNotIn('/srv/backroom/scripts',switch)
        self.assertNotIn('/srv/backroom/.secrets/switch.env',text)
        self.assertIn('--env-file /etc/backroom/switch.env',text)
        self.assertIn('-f /etc/backroom/switch-compose.yml',text)
        self.assertIn('/etc/backroom/studio-switch-watch.sh',switch)
        self.assertIn('d /etc/backroom 0700 root root',text)
        with tempfile.TemporaryDirectory() as temporary:
            attack=write(Path(temporary),'studio-writable.sh','#!/bin/sh\ntouch ROOT_ATTACK_EXECUTED\n')
            attack.chmod(0o777)
            with self.assertRaises(ValueError): broker.trusted(attack)
            self.assertFalse((Path(temporary)/'ROOT_ATTACK_EXECUTED').exists())
        installer=(ROOT/'scripts/studio-install-tools.sh').read_text()
        self.assertIn('restrict,from=',installer)
        self.assertIn('command="/run/current-system/sw/bin/python3 -I /etc/backroom/studio-deploy-broker.py"',installer)
        self.assertIn("key[1] not in line.split() and 'from=\"127.0.0.1\"' not in line",installer)

    def test_supervisor_no_double_start_and_crash_recovery(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / 'scripts').mkdir()
            for name in ('studio-supervise.sh', 'studio_supervise.py', 'run-door.sh', 'run-desk.sh'):
                shutil.copy2(ROOT / 'scripts' / name, root / 'scripts' / name)
            write(root, '.switch-runtime/projects/sample.json', '{}')
            fake = write(root, 'bin/bun', '''#!/usr/bin/env python3
import json,os,pathlib,signal,sys,time
root=pathlib.Path.cwd()
kind='door' if 'desk/src/door.ts' in sys.argv else 'desk'
with (root/'starts').open('a') as out: out.write(json.dumps({'kind':kind,'pid':os.getpid()})+'\\n')
signal.signal(signal.SIGTERM,lambda *_:sys.exit(0))
while True: time.sleep(.05)
''')
            fake.chmod(0o700)
            env = {**os.environ, 'PATH':str(fake.parent) + ':' + os.environ['PATH']}
            args = ['bash', str(root / 'scripts/studio-supervise.sh')]
            children = []
            def starts():
                return [json.loads(line) for line in (root / 'starts').read_text().splitlines()] if (root / 'starts').exists() else []
            try:
                first = subprocess.Popen(args, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                children.append(first)
                wait_for(lambda:len(starts()) == 2)
                second = subprocess.run(args, env=env, capture_output=True, text=True, timeout=3)
                self.assertEqual(second.returncode, 0)
                self.assertEqual(second.stdout, 'supervisor: already running\n')
                # Standalone door/desk launchers share the same locks too.
                for script, extra in [('run-door.sh', ['--foreground']), ('run-desk.sh', [str(root / '.switch-runtime/projects/sample.json')]), ('run-desk.sh', ['.switch-runtime/projects/sample.json'])]:
                    p = subprocess.run(['bash', str(root / 'scripts' / script), *extra], cwd=root, env=env, capture_output=True, timeout=3)
                    self.assertEqual(p.returncode, 0)
                self.assertEqual(len(starts()), 2)
                door = next(row for row in starts() if row['kind']=='door')
                os.kill(door['pid'], signal.SIGKILL)
                wait_for(lambda:len(starts()) == 3)
                self.assertEqual(sum(r['kind']=='desk' for r in starts()), 1)
                write(root, '.switch-runtime/projects/second.json', '{}')
                wait_for(lambda:len(starts()) == 4)
                first.terminate(); first.wait(timeout=12)
                for row in starts():
                    with self.assertRaises(ProcessLookupError): os.kill(row['pid'], 0)
            finally:
                for p in children:
                    if p.poll() is None: p.terminate(); p.wait(timeout=12)


if __name__ == '__main__':
    unittest.main(verbosity=2)
