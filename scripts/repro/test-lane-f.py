"""Lane F regressions: isolated trees, real Node/Git processes, no live services."""
import importlib.util
import contextlib
import io
import inspect
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT / file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


doctor = load('doctor_f', 'scripts/agent-doctor.py')
helper = load('helper_f', 'scripts/provision-helper.py')
apply = load('sync_f', 'scripts/studio-sync-apply.py')
old_sync_tests = load('old_sync_tests_f', 'scripts/repro/test-review-fixes.py')
provision_tests = load('provision_tests_f', 'scripts/repro/test-provision-helper.py')


def git(repo, *args, input=None):
    env = {**os.environ, 'GIT_CONFIG_NOSYSTEM': '1', 'GIT_CONFIG_GLOBAL': '/dev/null',
           'GIT_AUTHOR_NAME': 'Fictional', 'GIT_AUTHOR_EMAIL': 'sample@example.invalid',
           'GIT_COMMITTER_NAME': 'Fictional', 'GIT_COMMITTER_EMAIL': 'sample@example.invalid'}
    return subprocess.run(['git', *args], cwd=repo, env=env, input=input, check=True,
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE).stdout


def checkpoint(repo):
    git(repo, 'add', '.')
    tree = git(repo, 'write-tree').decode().strip()
    sha = git(repo, 'commit-tree', tree, '-m', 'Fictional Lane F fixture').decode().strip()
    git(repo, 'update-ref', 'refs/heads/main', sha)
    return sha


class LaneFTests(unittest.TestCase):
    def test_1_and_6_browser_uses_trusted_absolute_module_from_outside_fresh_workspace(self):
        node = shutil.which('node')
        self.assertIsNotNone(node, 'Existing Node binary required; no install performed')
        self.assertEqual(doctor.PLAYWRIGHT, '/srv/backroom/studio-kit/video/node_modules/playwright-core')
        with tempfile.TemporaryDirectory(prefix='backroom-f-doctor-') as temporary:
            root = Path(temporary)
            workspace = root / 'workspaces/sample'
            workspace.mkdir(parents=True)
            module = root / 'trusted/node_modules/playwright-core'
            module.mkdir(parents=True)
            cwd_file = root / 'probe-cwd.json'
            marker = root / 'sibling-project-marker'
            (module / 'index.js').write_text(
                "const fs=require('node:fs');fs.writeFileSync(" + json.dumps(str(cwd_file)) + ",JSON.stringify(process.cwd()));"
                "exports.chromium={launch:async()=>({newPage:async()=>({setContent:async()=>{},screenshot:async({path})=>fs.writeFileSync(path,'fictional png')}),close:async()=>{}})};")
            poison = root / 'poison.js'
            poison.write_text("require('node:fs').writeFileSync(" + json.dumps(str(marker)) + ",'fictional escaped write')")
            previous = Path.cwd()
            try:
                os.chdir(workspace)
                with patch.dict(os.environ, {'NODE_OPTIONS': '--require=' + str(poison), 'NODE_PATH': str(workspace / 'node_modules'), 'PATH': str(workspace / 'bin')}):
                    self.assertEqual(doctor.browser_probe(node, '/fictional/trusted/chromium', str(module)), (True, True))
                self.assertFalse((workspace / 'node_modules').exists())
                untrusted = workspace / 'node_modules/playwright-core'
                untrusted.mkdir(parents=True)
                (untrusted / 'index.js').write_text(poison.read_text())
                self.assertEqual(doctor.browser_probe(node, '/fictional/trusted/chromium', str(module)), (True, True))
            finally:
                os.chdir(previous)
            self.assertFalse(marker.exists())
            self.assertNotEqual(json.loads(cwd_file.read_text()), str(workspace))
            self.assertTrue(Path(json.loads(cwd_file.read_text())).name.startswith('backroom-tools-check-'))

    def test_1_git_probe_ignores_workspace_hooks_and_injected_git_environment(self):
        with tempfile.TemporaryDirectory(prefix='backroom-f-git-') as temporary:
            root = Path(temporary)
            workspace = root / 'workspace'
            (workspace / '.git').mkdir(parents=True)
            marker = root / 'hook-ran'
            hook = root / 'hook'
            hook.write_text('#!/bin/sh\ntouch ' + str(marker) + '\n')
            hook.chmod(0o700)
            hooks = root / 'template/hooks'
            hooks.mkdir(parents=True)
            shutil.copy2(hook, hooks / 'post-commit')
            (workspace / '.git/config').write_text('[core]\n fsmonitor = ' + str(hook) + '\n hooksPath = ' + str(hooks) + '\n')
            binary = shutil.which('git')
            observed = []
            real_run = doctor.run
            def run(args, **options):
                observed.append((args, options.get('cwd')))
                return real_run(args, **options)
            with patch.object(doctor, 'tool', side_effect=lambda name: binary if name == 'git' else '/fictional/' + name if name in ('pnpm', 'bun') else None), patch.object(doctor, 'builder_policy', return_value=True), patch.object(doctor, 'browser_probe', return_value=(True, True)), patch.object(doctor.urllib.request, 'urlopen', side_effect=OSError('fictional offline')), patch.object(doctor, 'run', side_effect=run), patch.dict(os.environ, {'GIT_TEMPLATE_DIR': str(hooks.parent), 'GIT_CONFIG_GLOBAL': str(workspace / '.git/config'), 'GIT_DIR': str(workspace / '.git')}):
                # Network intentionally fails; the real scratch Git commit still
                # runs and every Git command must carry the safe overrides.
                with contextlib.redirect_stdout(io.StringIO()) as output:
                    self.assertFalse(doctor.doctor(workspace))
                self.assertIn('PASS git scratch-branch commit', output.getvalue())
            self.assertFalse(marker.exists())
            self.assertGreater(len(observed), 0)
            for args, cwd in observed:
                self.assertEqual(args[0], binary)
                self.assertIn('core.hooksPath=/dev/null', args)
                self.assertIn('core.fsmonitor=false', args)
                self.assertNotEqual(Path(cwd), workspace)

    def test_1_agent_is_refused_even_in_shared_group_before_any_operation(self):
        studio = 12001
        agent = 12002
        with patch.object(helper.pwd, 'getpwnam', side_effect=lambda name: SimpleNamespace(pw_uid=studio if name == 'studio' else agent)), patch.object(helper.os, 'getgrouplist', return_value=[999]), patch.object(helper, 'prepare') as prepare, patch.object(helper, 'doctor') as probe:
            for operation in ['doctor', 'prepare-builder']:
                with self.assertRaisesRegex(helper.Refused, 'caller-group'):
                    helper.dispatch({'operation': operation, 'project': 'sample'}, agent, 999)
            self.assertTrue(helper.authorized(0, 0))
            self.assertTrue(helper.authorized(studio, 999))
            self.assertFalse(helper.authorized(agent, 999))
            prepare.assert_not_called()
            probe.assert_not_called()

    def test_2_actual_preparation_and_shadow_git_accept_clean_new_project_but_refuse_committed_policy(self):
        with provision_tests.ProvisionTests().fixture() as (root, workspace, home, _):
            git(workspace, 'init', '--template=', '-q', '-b', 'main')
            (workspace / 'build-report.md').write_text('AC-1: PASS - fictional request saved\n')
            (workspace / 'screen.png').write_bytes(bytes.fromhex('89504e470d0a1a0a'))
            (workspace / 'build-verification.json').write_text(json.dumps({'url': 'http://127.0.0.1:3210', 'screenshot': 'screen.png'}))
            base = checkpoint(workspace)
            with patch.object(helper, 'LOCK', str(root / 'helper.lock')):
                helper.prepare('sample', str(root / 'workspaces'), str(home))
            # Even a product ignore file trying to re-include the policy cannot
            # override harness pathspec exclusions in protected status.
            (workspace / '.git/info/exclude').write_text('!/.codex/\n')
            program = '''import {collectHandoffEvidence} from %s;import {inspectBuildHandoff} from %s;
const [workspace,base,expected]=process.argv.slice(1);const evidence=collectHandoffEvidence({workspace,base,scopeText:'',criteria:['AC-1'],bug:false,generation:1});
const failures=inspectBuildHandoff({workspace,criteria:['AC-1'],bug:false,reportName:'build-report.md',...evidence});
if(expected==='clean'&&(evidence.gitStatus.trim()||failures.length))throw Error(JSON.stringify(failures));
if(expected==='policy'&&!failures.some(x=>x.includes('Protected builder policy')))throw Error('committed policy accepted');
console.log(expected==='clean'?'PASS prepared project through real shadow Git':'PASS committed policy remains refused');'''
            program = program % (json.dumps(str(ROOT / 'desk/src/handoff-evidence.ts')), json.dumps(str(ROOT / 'desk/src/build-stage.ts')))
            shadow_home = root / 'shadow-home'
            shadow_home.mkdir()
            def check(expected):
                result = subprocess.run(['bun', '--no-env-file', '-e', program, str(workspace), base, expected], env={**os.environ, 'HOME': str(shadow_home)}, capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn('PASS ', result.stdout)
            check('clean')
            (workspace / 'request.test.ts').write_text('test("new request",()=>{})')
            git(workspace, 'add', 'request.test.ts')
            tree = git(workspace, 'write-tree').decode().strip()
            new_test_sha = git(workspace, 'commit-tree', tree, '-m', 'Fictional new test').decode().strip()
            git(workspace, 'update-ref', 'refs/heads/main', new_test_sha)
            check('clean')
            git(workspace, 'add', '-f', '.codex/config.toml')
            checkpoint(workspace)
            check('policy')

    def test_7_interrupted_mixed_sync_blocks_start_and_reruns_to_verified_completion(self):
        with tempfile.TemporaryDirectory(prefix='backroom-f-sync-') as temporary:
            root = Path(temporary)
            target = root / 'source'
            target.mkdir()
            files = {'a.txt': b'new a', 'b.txt': b'new b'}
            expected = {name: old_sync_tests.metadata(data) for name, data in files.items()}
            old = {}
            for name in files:
                data = ('old ' + name[0]).encode()
                (target / name).write_bytes(data)
                old[name] = old_sync_tests.metadata(data)
            record = root / 'managed.json'
            record.write_text(json.dumps(old))
            bundle = old_sync_tests.archive(files)
            events = []
            actual = apply.shutil.copyfileobj
            count = 0
            def interrupt(*args, **kwargs):
                nonlocal count
                count += 1
                if count == 4: raise OSError('fictional interrupted second replacement')
                return actual(*args, **kwargs)
            with patch.object(apply.shutil, 'copyfileobj', side_effect=interrupt), self.assertRaises(OSError):
                apply.apply(target, expected, bundle, record, events.append, (os.getuid(), os.getgid()))
            self.assertEqual((target / 'a.txt').read_bytes(), b'new a')
            self.assertEqual((target / 'b.txt').read_bytes(), b'old b')
            marker = root / 'sync-incomplete'
            self.assertTrue(marker.is_file())
            self.assertEqual(events, ['stop'])
            self.assertEqual(json.loads(record.read_text()), old)
            def control(action):
                if action == 'start':
                    self.assertFalse(marker.exists())
                    apply.verify(target, expected)
                events.append(action)
            apply.apply(target, expected, bundle, record, control, (os.getuid(), os.getgid()))
            self.assertFalse(marker.exists())
            self.assertEqual(events, ['stop', 'stop', 'start'])
            source = (ROOT / 'deploy/nixos/dev.nix').read_text()
            for part in [source.split('controller = name: after:', 1)[1].split('in {', 1)[0], source.split('systemd.services.backroom-studio = {', 1)[1].split('systemd.services.backroom-identity', 1)[0]]:
                self.assertIn('"!/var/lib/backroom/sync-incomplete"', part)

    def test_8_active_broker_and_adapter_are_installed_from_real_commit_and_verified(self):
        with tempfile.TemporaryDirectory(prefix='backroom-f-artifacts-') as temporary:
            root = Path(temporary)
            repo = root / 'repo'
            (repo / 'scripts').mkdir(parents=True)
            for name in ['studio-deploy-broker.py', 'studio-ssh.py']:
                shutil.copy2(ROOT / 'scripts' / name, repo / 'scripts' / name)
            (repo / 'deploy').mkdir()
            (repo / 'deploy/nix-deployer.ts').write_text('fictional exact-commit deployer')
            git(repo, 'init', '--template=', '-q', '-b', 'main')
            sha = checkpoint(repo)
            bundle = git(repo, 'archive', '--format=tar', sha)
            files = {str(path.relative_to(repo)): path.read_bytes() for path in [repo / 'scripts/studio-deploy-broker.py', repo / 'scripts/studio-ssh.py', repo / 'deploy/nix-deployer.ts']}
            expected = {name: old_sync_tests.metadata(data) for name, data in files.items()}
            target = root / 'source'
            target.mkdir()
            prefix = root / 'installed'
            installed = apply.installed_files(expected, prefix)
            for _, path, _ in installed:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'fictional old installed copy')
            owner = (os.getuid(), os.getgid())
            def control(action):
                if action == 'start':
                    apply.verify_installed(installed, expected, owner)
                    self.assertFalse((root / 'sync-incomplete').exists())
            apply.apply(target, expected, bundle, root / 'manifest.json', control, owner, prefix, owner)
            apply.verify_installed(installed, expected, owner)
            self.assertEqual(inspect.signature(apply.apply).parameters['install_owner'].default, (0, 0))
            broker = load('installed_broker_f', str(installed[0][1]))
            import shlex
            command = 'cd ' + str(broker.FLEET) + ' && exec ' + shlex.join(['nix', 'build', '--no-link', '--no-write-lock-file', 'path:' + str(broker.FLEET) + '#nixosConfigurations.deploy.config.system.build.toplevel'])
            self.assertEqual(broker.parse(command, 'root@192.0.2.10')[0], broker.BIN + 'nix')
            for source, path, mode in installed:
                self.assertEqual(path.read_bytes(), files[source])
                self.assertEqual(path.stat().st_mode & 0o777, mode)

    def test_8_partial_active_copy_never_starts_new_deployer_with_old_broker(self):
        with tempfile.TemporaryDirectory(prefix='backroom-f-partial-') as temporary:
            root = Path(temporary)
            target = root / 'source'
            target.mkdir()
            files = {'deploy/nix-deployer.ts': b'new deployer', 'scripts/studio-deploy-broker.py': b'new broker', 'scripts/studio-ssh.py': b'new adapter'}
            expected = {name: old_sync_tests.metadata(data) for name, data in files.items()}
            (target / 'deploy').mkdir()
            (target / 'deploy/nix-deployer.ts').write_bytes(b'old deployer')
            prefix = root / 'installed'
            installed = apply.installed_files(expected, prefix)
            for _, path, _ in installed:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b'old copy')
            original = apply.install_file
            def fail(source, destination, mode, owner):
                if destination == installed[1][1]: raise OSError('fictional installed adapter failure')
                return original(source, destination, mode, owner)
            events = []
            owner = (os.getuid(), os.getgid())
            with patch.object(apply, 'install_file', side_effect=fail), self.assertRaises(OSError):
                apply.apply(target, expected, old_sync_tests.archive(files), root / 'record.json', events.append, owner, prefix, owner)
            self.assertEqual((target / 'deploy/nix-deployer.ts').read_bytes(), b'old deployer')
            self.assertEqual(events, ['stop'])
            self.assertTrue((root / 'sync-incomplete').exists())
            self.assertEqual(installed[0][1].read_bytes(), b'new broker')
            installed[0][1].write_bytes(b'fictional corruption')
            with self.assertRaises(ValueError): apply.verify_installed(installed, expected, owner)
            apply.apply(target, expected, old_sync_tests.archive(files), root / 'record.json', events.append, owner, prefix, owner)
            self.assertEqual(events[-1], 'start')
            apply.verify_installed(installed, expected, owner)
            self.assertFalse((root / 'sync-incomplete').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)
